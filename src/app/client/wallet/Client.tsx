"use client";
import { dbConnect } from "@/lib/mongo";
import { PaymentAccount } from "@/models";
import { getCurrentUser } from "@/lib/auth";
import { Card } from "@/components/Shell";
import { DepositForm, WithdrawForm } from "@/components/WalletForms";
import { getSettings, vipInfo, withdrawnToday } from "@/lib/platform";
import { oid } from "@/models";
import { gatewayConfig } from "@/lib/gateway";
import { InstantPayForm } from "@/components/InstantPayForm";
import { WalletTabs } from "@/components/WalletTabs";
import { useI18n } from "@/lib/i18n/client";
import { usePage, NOT_FOUND, REDIRECT } from "@/lib/useDb";

export default function WalletPageClient({ params, searchParams }: { params?: Record<string, string>; searchParams?: Record<string, string> }) {
  const { t, locale } = useI18n();
  void locale;
  void params; void searchParams;
  return usePage(async () => {
    const me = (await getCurrentUser())!;
    await dbConnect();
    // ensure the client has random accounts assigned, then show only those
    const { assignPaymentAccounts } = await import("@/lib/platform");
    const assigned = await assignPaymentAccounts(me.id);
    const raw = await PaymentAccount.find({ isActive: true }).sort({ createdAt: 1 }).lean();
    const accounts = raw
      .filter((a) => Object.values(assigned).map(String).includes(String(a._id)))
      .map((a) => ({ id: String(a._id), provider: a.provider as "jazzcash" | "easypaisa", accountTitle: a.accountTitle, accountNumber: a.accountNumber }));
    const settings = await getSettings();
    const { cur } = vipInfo(me.vipLevel, settings.vipLevels);
    const usedToday = await withdrawnToday(oid(me.id));
    const limits = { name: `VIP ${me.vipLevel} ${cur?.name ?? ""}`, daily: cur?.dailyWithdrawLimit ?? 0, perMax: cur?.perWithdrawMax ?? 0, usedToday, min: cur?.minWithdraw ?? settings.wallet?.minWithdraw ?? 1000 };
    const gw = await gatewayConfig();
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2"><h1 className="text-2xl font-bold text-white">{t("walletTitle")}</h1><span className="rounded-full bg-black/30 px-3 py-1 text-sm text-[#b8a7e6] ring-1 ring-[#3a2470]">{t("balance")}: <b className="text-[#ffb800]">Rs. {me.balance.toLocaleString()}</b></span></div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title={t("depositTitle")}>
            {gw.enabled ? (
              <WalletTabs
                tabs={[
                  { key: "instant", label: gw.label, badge: "TEST", content: <InstantPayForm kind="deposit" min={gw.minDeposit} max={gw.maxPerTxn} label={gw.label} hasPin={me.hasPin} accounts={accounts} /> },
                  { key: "manual", label: "Manual (TID)", content: <DepositForm accounts={accounts} /> },
                ]}
              />
            ) : <DepositForm accounts={accounts} />}
          </Card>
          <Card title={t("withdrawTitle")}>
            {gw.enabled && gw.autoWithdraw ? (
              <WalletTabs
                tabs={[
                  { key: "instant", label: "Instant Withdraw", badge: "TEST", content: <InstantPayForm kind="withdraw" min={limits.min} max={Math.min(gw.maxPerTxn, limits.perMax || gw.maxPerTxn)} label="Instant Withdraw (Test)" hasPin={me.hasPin} /> },
                  { key: "manual", label: "Request (24h)", content: <WithdrawForm balance={me.balance} hasPin={me.hasPin} limits={limits} /> },
                ]}
              />
            ) : <WithdrawForm balance={me.balance} hasPin={me.hasPin} limits={limits} />}
          </Card>
        </div>
      </div>
    );
  }, [JSON.stringify(params ?? {}), JSON.stringify(searchParams ?? {})]);
}
