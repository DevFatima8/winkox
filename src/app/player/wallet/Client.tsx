"use client";
import { Card } from "@/components/Shell";
import { DepositForm, WithdrawForm } from "@/components/WalletForms";
import { InstantPayForm } from "@/components/InstantPayForm";
import { WalletTabs } from "@/components/WalletTabs";
import { WinHoldCard } from "@/components/WinHoldCard";
import { useI18n } from "@/lib/i18n/client";
import { usePage, NOT_FOUND, REDIRECT } from "@/lib/useDb";

export default function WalletPageClient({ params, searchParams }: { params?: Record<string, string>; searchParams?: Record<string, string> }) {
  const { t, locale } = useI18n();
  void locale;
  void params;
  const requestedAmount = Number(searchParams?.amount);
  const initialDepositAmount = Number.isFinite(requestedAmount) && requestedAmount > 0 ? requestedAmount : undefined;
  return usePage(async () => {
    const response = await fetch("/api/player/wallet", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Wallet data load nahi ho saka.");
    const { me, accounts, limits, gateway: gw, holds } = data;
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2"><h1 className="text-2xl font-bold text-white">{t("walletTitle")}</h1><span className="rounded-full bg-black/30 px-3 py-1 text-sm text-[#b8a7e6] ring-1 ring-[#3a2470]">{t("balance")}: <b className="text-[#ffb800]">Rs. {me.balance.toLocaleString()}</b></span></div>
        <WinHoldCard locked={holds.locked} claimable={holds.claimable} />
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title={t("depositTitle")}>
            {gw.enabled ? (
              <WalletTabs
                tabs={[
                  { key: "instant", label: gw.label, badge: "TEST", content: <InstantPayForm kind="deposit" min={gw.minDeposit} max={gw.maxPerTxn} initialAmount={initialDepositAmount} label={gw.label} hasPin={me.hasPin} accounts={accounts} /> },
                  { key: "manual", label: "Manual (TID)", content: <DepositForm accounts={accounts} initialAmount={initialDepositAmount} /> },
                ]}
              />
            ) : <DepositForm accounts={accounts} initialAmount={initialDepositAmount} />}
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
