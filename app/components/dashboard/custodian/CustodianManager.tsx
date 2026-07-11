"use client";

import { FC, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useVault } from "@/hooks/useVault";
import { useParsedKey } from "@/hooks/useParsedKey";
import { Field, Input, TxButton } from "../shared/ui";
import { KeyList } from "../shared/KeyList";

interface CustodianManagerProps {
  refresh: () => void;
  custodians: {
    publicKey: PublicKey;
    account: { wallet: PublicKey; hasApproved: boolean };
  }[];
  isActive: boolean;
}

export const CustodianManager: FC<CustodianManagerProps> = ({
  refresh,
  custodians,
  isActive,
}) => {
  const vault = useVault();
  const [addr, setAddr] = useState("");
  const parsed = useParsedKey(addr);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="text-base font-semibold text-white">
          Custodians Quorum
        </h3>
        <p className="text-xs text-muted mt-1">
          Designate trusted custodians who confirm passing. They cannot read
          documents, only confirm inactivity.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-white/5 bg-black/10 p-4">
        <Field label="Custodian wallet address">
          <Input
            placeholder="e.g. 7H4qB2EYAaXk..."
            value={addr}
            onChange={(e) => setAddr(e.target.value)}
            disabled={!isActive}
          />
        </Field>
        <TxButton
          disabled={!isActive || !parsed}
          title={
            !isActive ? "Actions are only allowed when the will is active" : ""
          }
          action={() => vault.addCustodian(parsed!)}
          onDone={() => {
            setAddr("");
            refresh();
          }}
        >
          Add custodian
        </TxButton>
      </div>

      <div className="mt-2">
        <h4 className="text-xs font-semibold text-white mb-2.5 uppercase tracking-wider">
          Custodian Quorum list ({custodians.length})
        </h4>
        <KeyList
          items={custodians.map((c) => ({
            key: c.publicKey.toBase58(),
            wallet: c.account.wallet,
            badge: c.account.hasApproved
              ? "Confirmed Passing"
              : "Pending Confirmation",
            badgeStyle: c.account.hasApproved ? "success" : "warn",
          }))}
          onRemove={(wallet) => vault.removeCustodian(wallet)}
          refresh={refresh}
          disabled={!isActive}
          empty="No custodians named. The will won't be claimable without custodians if minimum approvals > 0."
        />
      </div>
    </div>
  );
};
