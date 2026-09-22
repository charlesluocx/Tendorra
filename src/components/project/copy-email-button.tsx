"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CopyEmailButton({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(email);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // Clipboard API can be unavailable (e.g. insecure context); the
          // address is still shown as selectable text either way.
        }
      }}
    >
      {copied ? "Copied!" : "Copy"}
    </Button>
  );
}
