"use client";

import { FC, useState } from "react";
import { useVault } from "@/hooks/useVault";
import { Field, Input, TxButton } from "../shared/ui";

interface UpdateWillFormProps {
  refresh: () => void;
  isActive: boolean;
}

export const UpdateWillForm: FC<UpdateWillFormProps> = ({
  refresh,
  isActive,
}) => {
  const vault = useVault();
  const [days, setDays] = useState("");
  const [minApproval, setMinApproval] = useState("");
  const dirty = days !== "" || minApproval !== "";

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <Field label="New threshold (days)">
          <Input
            type="number"
            min={1}
            placeholder="unchanged"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            disabled={!isActive}
          />
        </Field>
      </div>
      <div className="flex-1">
        <Field label="New min approvals">
          <Input
            type="number"
            min={1}
            placeholder="unchanged"
            value={minApproval}
            onChange={(e) => setMinApproval(e.target.value)}
            disabled={!isActive}
          />
        </Field>
      </div>
      <TxButton
        disabled={!isActive || !dirty}
        title={!isActive ? "Actions are only allowed when the will is active" : ""}
        action={() =>
          vault.updateWill(
            days === "" ? null : Number(days) * 86_400,
            minApproval === "" ? null : Number(minApproval)
          )
        }
        onDone={() => {
          setDays("");
          setMinApproval("");
          refresh();
        }}
      >
        Update Settings
      </TxButton>
    </div>
  );
};
