"use client";
import { getCurrentUser } from "@/lib/auth";
import { SettingsForm } from "@/components/admin/Forms";
import { getSettings } from "@/lib/platform";
import { usePage, NOT_FOUND, REDIRECT } from "@/lib/useDb";

export default function SettingsPageClient({ params, searchParams }: { params?: Record<string, string>; searchParams?: Record<string, string> }) {
  void params; void searchParams;
  return usePage(async () => {
  const _me = await getCurrentUser();
  if (!_me || _me.level < 2) return REDIRECT("/admin");
  const s = await getSettings();
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-white">Platform Settings</h1><p className="text-sm text-[#b8a7e6]">Support hours, WhatsApp/Telegram channels, app links, referral commission aur wallet limits.</p></div>
      <SettingsForm s={{
        support: { enabled: s.support?.enabled ?? true, is247: s.support?.is247 ?? false, startHour: s.support?.startHour ?? 9, endHour: s.support?.endHour ?? 23, offlineMessage: s.support?.offlineMessage ?? "", welcomeMessage: s.support?.welcomeMessage ?? "" },
        links: { whatsapp: s.links?.whatsapp ?? "", whatsappChannel: s.links?.whatsappChannel ?? "", telegram: s.links?.telegram ?? "", telegramChannel: s.links?.telegramChannel ?? "", facebook: s.links?.facebook ?? "", instagram: s.links?.instagram ?? "", youtube: s.links?.youtube ?? "" },
        app: { androidUrl: s.app?.androidUrl ?? "", iosUrl: s.app?.iosUrl ?? "", version: s.app?.version ?? "1.0.0" },
        referral: { depositCommissionPct: s.referral?.depositCommissionPct ?? 4, betCommissionPct: s.referral?.betCommissionPct ?? 1.5, signupBonus: s.referral?.signupBonus ?? 0, agentDepositCommissionPct: s.referral?.agentDepositCommissionPct ?? 8 },
        wallet: { minDeposit: s.wallet?.minDeposit ?? 100, minWithdraw: s.wallet?.minWithdraw ?? 500 },
        fakeGateway: { enabled: s.fakeGateway?.enabled ?? true, autoWithdraw: s.fakeGateway?.autoWithdraw ?? true, testOtp: s.fakeGateway?.testOtp ?? "1234", maxPerTxn: s.fakeGateway?.maxPerTxn ?? 50000, dailyLimit: s.fakeGateway?.dailyLimit ?? 200000, label: s.fakeGateway?.label ?? "Instant Deposit (Test Mode)" },
      }} />
    </div>
  );
  }, [JSON.stringify(params ?? {}), JSON.stringify(searchParams ?? {})]);
}
