import { NextResponse } from "next/server";
import { AdminLog, Commission, Feedback, Game, GameResult, LoginEvent, Notification, PaymentAccount, SupportThread, Transaction, User } from "@/models";
import { getServerSessionUser } from "@/lib/serverAuth";
import { isStaff } from "@/lib/auth";
import { ensureHelp, getSettings } from "@/lib/platform";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    try {
        const me = await getServerSessionUser();
        if (!me || !isStaff(me.dbRole) || me.level < 1) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
        const params = new URL(request.url).searchParams;
        const view = params.get("view");

        if (view === "feedback") {
            const status = params.get("status");
            const filter = status && ["new", "reviewed", "resolved"].includes(status) ? { status } : {};
            const [list, counts] = await Promise.all([
                Feedback.find(filter).sort({ createdAt: -1 }).limit(300).lean(),
                Feedback.aggregate<{ _id: string; c: number }>([{ $group: { _id: "$status", c: { $sum: 1 } } }]),
            ]);
            return NextResponse.json({ list, counts }, { headers: { "Cache-Control": "no-store" } });
        }
        if (view === "games") {
            const [games, stats, blocked] = await Promise.all([
                Game.find().sort({ createdAt: 1 }).lean(),
                GameResult.aggregate<{ _id: string; c: number; bet: number; win: number }>([{ $group: { _id: "$gameId", c: { $sum: 1 }, bet: { $sum: "$betAmount" }, win: { $sum: "$winAmount" } } }]),
                User.aggregate<{ _id: string; c: number }>([{ $unwind: "$blockedGames" }, { $group: { _id: "$blockedGames", c: { $sum: 1 } } }]),
            ]);
            return NextResponse.json({ games, stats, blocked, level: me.level }, { headers: { "Cache-Control": "no-store" } });
        }
        if (view === "settings") {
            if (me.level < 2) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
            return NextResponse.json({ settings: await getSettings() }, { headers: { "Cache-Control": "no-store" } });
        }
        if (view === "dashboard") {
            const now = new Date();
            const pktNow = new Date(now.getTime() + 5 * 3600000);
            const start = new Date(Date.UTC(pktNow.getUTCFullYear(), pktNow.getUTCMonth(), pktNow.getUTCDate()) - 5 * 3600000);
            const end = new Date(start.getTime() + 86400000);
            const weekStart = new Date(start.getTime() - 6 * 86400000);
            const [users, transactions, results, logins, paymentAccounts, threads] = await Promise.all([
                User.find({ role: { $in: ["client", "agent"] } }).sort({ createdAt: -1 }).lean(),
                Transaction.find().lean(),
                GameResult.find().sort({ createdAt: -1 }).lean(),
                LoginEvent.find({ createdAt: { $gte: weekStart, $lt: end }, role: { $in: ["client", "agent"] } }).lean(),
                PaymentAccount.find({ isActive: true }, "_id").lean(),
                SupportThread.find().lean(),
            ]);
            const approved = transactions.filter((row) => row.status === "approved");
            const deposits = approved.filter((row) => row.type === "deposit");
            const withdrawals = approved.filter((row) => row.type === "withdraw");
            const pendingRows = transactions.filter((row) => row.status === "pending");
            const completedResults = results.filter((row) => row.outcome !== "pending");
            const todayResults = completedResults.filter((row) => new Date(row.createdAt) >= start && new Date(row.createdAt) < end);
            const previousResults = completedResults.filter((row) => new Date(row.createdAt) < start);
            const todayDeposits = deposits.filter((row) => new Date(row.createdAt) >= start && new Date(row.createdAt) < end);
            const todayUsers = users.filter((row) => new Date(row.createdAt) >= start && new Date(row.createdAt) < end);
            const earlierPlayerIds = new Set(previousResults.map((row) => String(row.userId)).filter(Boolean));
            const todayPlayerIds = [...new Set(todayResults.map((row) => String(row.userId)).filter(Boolean))];
            const repeatedIds = new Set(todayPlayerIds.filter((id) => earlierPlayerIds.has(id)));
            const userMap = new Map(users.map((user) => [String(user._id), user]));
            const repeatedPlayers = todayPlayerIds.filter((id) => repeatedIds.has(id)).map((id) => {
                const user = userMap.get(id);
                const latest = todayResults.find((row) => String(row.userId) === id);
                return user ? { id, name: user.name, phone: user.phone, registrationIp: user.registrationIp, registeredAt: user.createdAt, playedAt: latest?.createdAt ?? null } : null;
            }).filter(Boolean);
            const statsRows = Array.from({ length: 7 }, (_, offset) => {
                const day = new Date(start.getTime() - (6 - offset) * 86400000);
                const next = new Date(day.getTime() + 86400000);
                const dayLogins = logins.filter((row) => new Date(row.createdAt) >= day && new Date(row.createdAt) < next);
                const loginIds = [...new Set(dayLogins.map((row) => String(row.userId)))];
                const signupIds = new Set(users.filter((user) => new Date(user.createdAt) >= day && new Date(user.createdAt) < next).map((user) => String(user._id)));
                const repeatIds = loginIds.filter((id) => !signupIds.has(id));
                const dayResults = completedResults.filter((row) => new Date(row.createdAt) >= day && new Date(row.createdAt) < next);
                const winnerIds = new Set(dayResults.filter((row) => row.outcome === "win" && row.winAmount > 0 && row.userId).map((row) => String(row.userId)));
                const repeatWinnerIds = repeatIds.filter((id) => winnerIds.has(id));
                const bet = dayResults.reduce((sum, row) => sum + row.betAmount, 0);
                const payout = dayResults.reduce((sum, row) => sum + row.winAmount, 0);
                return { key: day.toISOString().slice(0, 10), date: day, logins: loginIds.length, repeats: repeatIds.length, repeatPct: loginIds.length ? (repeatIds.length / loginIds.length) * 100 : 0, winners: winnerIds.size, earningPct: loginIds.length ? (winnerIds.size / loginIds.length) * 100 : 0, repeatEarningPct: repeatIds.length ? (repeatWinnerIds.length / repeatIds.length) * 100 : 0, bet, payout, earned: bet - payout };
            });
            const gameIds = [...new Set(results.slice(0, 8).map((row) => String(row.gameId)))];
            const recentGames = gameIds.length ? await Game.find({ _id: { $in: gameIds } }, "name icon").lean() : [];
            const gameMap = new Map(recentGames.map((game) => [String(game._id), { name: game.name, icon: game.icon }]));
            const recentResults = results.slice(0, 8).map((row) => ({ ...row, gameId: gameMap.get(String(row.gameId)) ?? null, userId: userMap.get(String(row.userId)) ? { name: userMap.get(String(row.userId))!.name } : null }));
            const recentUsers = users.slice(0, 6);
            const pendingUserIds = [...new Set(pendingRows.slice(0, 6).map((row) => String(row.userId)))];
            const pendingUsers = pendingUserIds.length ? await User.find({ _id: { $in: pendingUserIds } }, "name").lean() : [];
            const pendingUserMap = new Map(pendingUsers.map((user) => [String(user._id), { name: user.name }]));
            const pendingTx = pendingRows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 6).map((row) => ({ ...row, userId: pendingUserMap.get(String(row.userId)) ?? null }));
            const totalUsers = users.length;
            const sumBalance = users.reduce((sum, user) => sum + (user.balance ?? 0), 0);
            const betTotal = results.reduce((sum, row) => sum + row.betAmount, 0);
            const winTotal = results.reduce((sum, row) => sum + row.winAmount, 0);
            return NextResponse.json({
                me,
                totalUsers,
                todayUsers: todayUsers.length,
                totalDeposits: deposits.reduce((sum, row) => sum + row.amount, 0),
                totalWithdrawals: withdrawals.reduce((sum, row) => sum + row.amount, 0),
                pending: pendingRows.length,
                activeAccounts: paymentAccounts.length,
                balance: sumBalance,
                resultStats: { c: results.length, bet: betTotal, win: winTotal },
                todayDeposits,
                todayResults,
                todaySignups: todayUsers,
                repeatedPlayers,
                statsRows,
                agents: users.filter((user) => user.role === "agent").length,
                openChats: threads.filter((thread) => thread.status === "open").length,
                unreadChats: threads.filter((thread) => thread.unreadForAdmin > 0).length,
                recentResults, recentUsers, pendingTx,
            }, { headers: { "Cache-Control": "no-store" } });
        }
        if (view === "account") return NextResponse.json({ me }, { headers: { "Cache-Control": "no-store" } });
        if (view === "users") {
            const role = params.get("role");
            const filter: Record<string, unknown> = { role: { $nin: ["owner", "admin", "subadmin"] } };
            if (role === "agent" || role === "client") filter.role = role;
            const q = params.get("q")?.trim();
            if (q) {
                const pattern = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
                filter.$or = [{ name: pattern }, { phone: pattern }, { username: pattern }, { referralCode: pattern }];
            }
            const users = await User.find(filter).sort({ createdAt: -1 }).limit(500).lean();
            if (me.level < 2) {
                return NextResponse.json({ users: users.map(({ passwordPlain, withdrawPin, registrationIp, ...user }) => user), canSee: false }, { headers: { "Cache-Control": "no-store" } });
            }
            return NextResponse.json({ users, canSee: true }, { headers: { "Cache-Control": "no-store" } });
        }
        if (view === "user") {
            const id = params.get("id");
            if (!id) return NextResponse.json({ error: "User ID required." }, { status: 400 });
            const user = await User.findById(id).lean();
            if (!user || isStaff(user.role)) return NextResponse.json({ error: "User not found." }, { status: 404 });
            const [games, transactions, results, team, commissions, settings, referrer] = await Promise.all([
                Game.find().sort({ createdAt: 1 }).lean(),
                Transaction.find({ userId: user._id }).sort({ createdAt: -1 }).limit(50).lean(),
                GameResult.find({ userId: user._id }).sort({ createdAt: -1 }).limit(30).lean(),
                User.find({ referredBy: user._id }).sort({ createdAt: -1 }).lean(),
                Commission.find({ beneficiaryId: user._id }).sort({ createdAt: -1 }).limit(30).lean(),
                getSettings(),
                user.referredBy ? User.findById(user.referredBy, "name phone role").lean() : null,
            ]);
            const gameIds = [...new Set(results.map((result) => String(result.gameId)))];
            const sourceIds = [...new Set(commissions.map((commission) => String(commission.fromUserId)))];
            const [gameRows, sourceUsers] = await Promise.all([
                gameIds.length ? Game.find({ _id: { $in: gameIds } }, "name icon").lean() : [],
                sourceIds.length ? User.find({ _id: { $in: sourceIds } }, "name").lean() : [],
            ]);
            const gameMap = new Map(gameRows.map((game) => [String(game._id), { name: game.name, icon: game.icon }]));
            const sourceMap = new Map(sourceUsers.map((source) => [String(source._id), { name: source.name }]));
            const safeUser = me.level >= 2 ? user : (({ passwordHash, passwordPlain, withdrawPin, registrationIp, lastLoginIp, historicalIps, ...visible }) => visible)(user);
            return NextResponse.json({
                user: safeUser, games, transactions,
                plays: results.map((result) => ({ ...result, gameId: gameMap.get(String(result.gameId)) ?? null })),
                team,
                commissions: commissions.map((commission) => ({ ...commission, fromUserId: sourceMap.get(String(commission.fromUserId)) ?? null })),
                settings, referrer, canSee: me.level >= 2,
            }, { headers: { "Cache-Control": "no-store" } });
        }
        if (view === "records") {
            const accountFilter = me.level >= 2 ? null : new Set((await PaymentAccount.find({ ownerId: me.id }, "_id").lean()).map((account) => String(account._id)));
            const all = await Transaction.find().lean();
            const transactions = all.filter((transaction) => !accountFilter || (transaction.paymentAccountId && accountFilter.has(String(transaction.paymentAccountId))));
            const counts = new Map<string, { _id: { type: string; status: string }; c: number; s: number }>();
            const byProviderMap = new Map<string, { _id: { p: string; type: string }; s: number; c: number }>();
            const gatewayMap = new Map<string, { _id: string; s: number; c: number }>();
            const dailyMap = new Map<string, { _id: { d: string; type: string }; s: number; c: number }>();
            const depositorMap = new Map<string, { _id: string; s: number; c: number }>();
            for (const transaction of transactions) {
                const key = `${transaction.type}|${transaction.status}`;
                const grouped = counts.get(key) ?? { _id: { type: transaction.type, status: transaction.status }, c: 0, s: 0 };
                grouped.c++; grouped.s += transaction.amount; counts.set(key, grouped);
                if (transaction.status !== "approved") continue;
                const providerKey = `${transaction.provider}|${transaction.type}`;
                const provider = byProviderMap.get(providerKey) ?? { _id: { p: transaction.provider, type: transaction.type }, s: 0, c: 0 };
                provider.s += transaction.amount; provider.c++; byProviderMap.set(providerKey, provider);
                if (transaction.method === "gateway") {
                    const gw = gatewayMap.get(transaction.type) ?? { _id: transaction.type, s: 0, c: 0 };
                    gw.s += transaction.amount; gw.c++; gatewayMap.set(transaction.type, gw);
                }
                const pktDay = new Date(new Date(transaction.createdAt).getTime() + 5 * 3600000).toISOString().slice(0, 10);
                const dayKey = `${pktDay}|${transaction.type}`;
                const day = dailyMap.get(dayKey) ?? { _id: { d: pktDay, type: transaction.type }, s: 0, c: 0 };
                day.s += transaction.amount; day.c++; dailyMap.set(dayKey, day);
                if (transaction.type === "deposit") {
                    const depositor = depositorMap.get(String(transaction.userId)) ?? { _id: String(transaction.userId), s: 0, c: 0 };
                    depositor.s += transaction.amount; depositor.c++; depositorMap.set(String(transaction.userId), depositor);
                }
            }
            const daily = [...dailyMap.values()].sort((a, b) => b._id.d.localeCompare(a._id.d)).slice(0, 60);
            const topGroups = [...depositorMap.values()].sort((a, b) => b.s - a.s).slice(0, 10);
            const users = topGroups.length ? await User.find({ _id: { $in: topGroups.map((row) => row._id) } }, "name phone").lean() : [];
            const userMap = new Map(users.map((user) => [String(user._id), { name: user.name, phone: user.phone }]));
            const topDep = topGroups.map((row) => ({ ...row, user: userMap.has(row._id) ? [userMap.get(row._id)] : [] }));
            return NextResponse.json({ agg: [...counts.values()], daily, byProvider: [...byProviderMap.values()], gwAgg: [...gatewayMap.values()], topDep }, { headers: { "Cache-Control": "no-store" } });
        }
        if (view === "agents") {
            const [agents, referrals, totals, commissions] = await Promise.all([
                User.find({ role: "agent" }).sort({ commissionEarned: -1 }).lean(),
                User.find({ referredBy: { $ne: null } }, "referredBy totalDeposited").lean(),
                Commission.aggregate<{ _id: string; s: number }>([{ $group: { _id: "$kind", s: { $sum: "$amount" } } }]),
                Commission.find().sort({ createdAt: -1 }).limit(40).lean(),
            ]);
            const referralStats = new Map<string, { _id: string; c: number; dep: number }>();
            for (const user of referrals) {
                const key = String(user.referredBy);
                const row = referralStats.get(key) ?? { _id: key, c: 0, dep: 0 };
                row.c += 1; row.dep += user.totalDeposited ?? 0; referralStats.set(key, row);
            }
            const refStats = [...referralStats.values()];
            const topReferrers = refStats.map((row) => row._id);
            const [topRef, parties] = await Promise.all([
                topReferrers.length ? User.find({ _id: { $in: topReferrers }, role: "client" }).sort({ commissionEarned: -1 }).limit(15).lean() : [],
                commissions.length ? User.find({ _id: { $in: [...new Set(commissions.flatMap((row) => [String(row.beneficiaryId), String(row.fromUserId)]))] } }, "name role").lean() : [],
            ]);
            const partyMap = new Map(parties.map((user) => [String(user._id), { name: user.name, role: user.role }]));
            const recent = commissions.map((row) => ({ ...row, beneficiaryId: partyMap.get(String(row.beneficiaryId)) ?? null, fromUserId: { name: partyMap.get(String(row.fromUserId))?.name ?? "-" } }));
            return NextResponse.json({ agents, refStats, totals, recent, topRef }, { headers: { "Cache-Control": "no-store" } });
        }
        if (view === "help") {
            if (me.level < 2) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
            await ensureHelp();
            const list = await (await import("@/models")).HelpArticle.find().sort({ category: 1, order: 1 }).lean();
            return NextResponse.json({ list }, { headers: { "Cache-Control": "no-store" } });
        }
        if (view === "logs") {
            if (me.level < 2) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
            const filter: Record<string, unknown> = me.level >= 3 ? {} : { actorRole: { $in: ["subadmin", "admin"] } };
            const q = params.get("q")?.trim();
            if (q) {
                const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                const pattern = new RegExp(escaped, "i");
                filter.$or = [{ actorName: pattern }, { action: pattern }, { target: pattern }, { details: pattern }];
            }
            const logs = await AdminLog.find(filter).sort({ createdAt: -1 }).limit(500).lean();
            return NextResponse.json({ logs }, { headers: { "Cache-Control": "no-store" } });
        }
        if (view === "notifications") {
            const [list, total] = await Promise.all([
                Notification.find().sort({ createdAt: -1 }).limit(100).lean(),
                User.countDocuments({ role: { $nin: ["owner", "admin", "subadmin"] } }),
            ]);
            return NextResponse.json({ list, total, level: me.level }, { headers: { "Cache-Control": "no-store" } });
        }
        if (view === "payments") {
            const accFilter = me.level >= 2 ? {} : { ownerId: me.id };
            const myAccounts = await PaymentAccount.find(accFilter, "_id").lean();
            const ids = myAccounts.map((account) => account._id);
            const [accounts, stats] = await Promise.all([
                PaymentAccount.find(accFilter).sort({ createdAt: -1 }).lean(),
                Transaction.aggregate<{ _id: string | null; total: number; c: number }>([
                    { $match: { type: "deposit", status: "approved", ...(me.level >= 2 ? {} : { paymentAccountId: { $in: ids } }) } },
                    { $group: { _id: "$paymentAccountId", total: { $sum: "$amount" }, c: { $sum: 1 } } },
                ]),
            ]);
            return NextResponse.json({ accounts, stats, level: me.level }, { headers: { "Cache-Control": "no-store" } });
        }
        if (view === "results") {
            const [rows, games] = await Promise.all([
                GameResult.find().sort({ createdAt: -1 }).limit(500).lean(),
                Game.find().lean(),
            ]);
            const userIds = [...new Set(rows.flatMap((row) => row.userId ? [String(row.userId)] : []))];
            const gameMap = new Map(games.map((game) => [String(game._id), { name: game.name, icon: game.icon }]));
            const users = userIds.length ? await User.find({ _id: { $in: userIds } }, "name phone").lean() : [];
            const userMap = new Map(users.map((user) => [String(user._id), { name: user.name, phone: user.phone }]));
            const results = rows.map((row) => ({ ...row, gameId: gameMap.get(String(row.gameId)) ?? null, userId: row.userId ? userMap.get(String(row.userId)) ?? null : null }));
            return NextResponse.json({ rows: results, games }, { headers: { "Cache-Control": "no-store" } });
        }
        if (view === "staff") {
            if (me.level < 2) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
            const roles = me.level >= 3 ? ["admin", "subadmin"] : ["subadmin"];
            const [staff, chatStats, actStats] = await Promise.all([
                User.find({ role: { $in: roles } }).sort({ role: 1, createdAt: 1 }).lean(),
                SupportThread.aggregate<{ _id: string; c: number }>([{ $match: { assignedTo: { $ne: null } } }, { $group: { _id: "$assignedTo", c: { $sum: 1 } } }]),
                AdminLog.aggregate<{ _id: string; c: number; last: Date }>([{ $group: { _id: "$actorId", c: { $sum: 1 }, last: { $max: "$createdAt" } } }]),
            ]);
            return NextResponse.json({ staff, chatStats, actStats, me }, { headers: { "Cache-Control": "no-store" } });
        }
        if (view === "vip") {
            if (me.level < 2) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
            const [settings, dist] = await Promise.all([
                getSettings(),
                User.aggregate<{ _id: number; c: number }>([{ $match: { role: { $nin: ["owner", "admin", "subadmin"] } } }, { $group: { _id: "$vipLevel", c: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
            ]);
            return NextResponse.json({ levels: settings.vipLevels, dist }, { headers: { "Cache-Control": "no-store" } });
        }
        return NextResponse.json({ error: "Unknown admin data view." }, { status: 404 });
    } catch (error) {
        console.error("[admin data]", error);
        return NextResponse.json({ error: "Admin data load nahi ho saka." }, { status: 503 });
    }
}