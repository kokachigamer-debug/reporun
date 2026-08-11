import { type ReactNode } from "react";
import { Badge } from "@/components/shared";
import { useLicenseStatus } from "@/queries/auth";

export function TopBar({
  title,
  right,
}: {
  title: ReactNode;
  right?: ReactNode;
}) {
  const { data: license } = useLicenseStatus();
  return (
    <header className="flex h-12 items-center justify-between border-b border-rr-hairline bg-rr-canvas px-5">
      <div className="text-sm font-medium text-rr-text">{title}</div>
      <div className="flex items-center gap-2">
        {right}
        {license ? (
          <Badge
            className={
              license.status === "valid"
                ? "border-rr-tier3/30 bg-[#dafbe1] text-rr-tier3"
                : license.status === "trial"
                  ? "border-rr-accent/30 bg-rr-accentSoft text-rr-accent"
                  : license.status === "expired"
                    ? "border-rr-danger/30 bg-[#ffebe9] text-rr-danger"
                    : "text-rr-subtle"
            }
          >
            {license.status}
          </Badge>
        ) : null}
      </div>
    </header>
  );
}
