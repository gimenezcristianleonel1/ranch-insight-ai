import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Paperclip } from "lucide-react";
import { Attachments } from "@/components/attachments";
import type { EntityType } from "@/lib/storage";

export function AttachmentsButton({
  entityType,
  entityId,
  title,
  categoria,
}: {
  entityType: EntityType;
  entityId: string;
  title?: string;
  categoria?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOpen(true)} title="Archivos">
        <Paperclip className="h-4 w-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{title ?? "Archivos"}</DialogTitle></DialogHeader>
          {open && <Attachments entityType={entityType} entityId={entityId} categoria={categoria} />}
        </DialogContent>
      </Dialog>
    </>
  );
}