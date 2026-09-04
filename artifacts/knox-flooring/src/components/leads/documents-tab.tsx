import { useRef } from "react";
import { useUpload } from "@workspace/object-storage-web";
import { Button } from "@/components/ui/button";
import { FileText, Trash2, Loader2, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { LeadDocument } from "@/lib/types";

export function documentSrc(objectPath: string): string {
  return `/api/storage${objectPath}`;
}

function formatSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface DocumentsTabProps {
  documents: LeadDocument[];
  onSave: (documents: LeadDocument[]) => Promise<void> | void;
}

export function DocumentsTab({ documents, onSave }: DocumentsTabProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { uploadFile, isUploading } = useUpload({
    onError: (err: Error) =>
      toast({
        title: "Upload failed",
        description: err.message,
        variant: "destructive",
      }),
  });

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await uploadFile(file);
    if (result) {
      const doc: LeadDocument = {
        id: crypto.randomUUID(),
        name: file.name,
        objectPath: result.objectPath,
        contentType: file.type || undefined,
        size: file.size,
        createdAt: new Date().toISOString(),
      };
      await onSave([...documents, doc]);
      toast({ title: "Document uploaded" });
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const remove = (id: string) =>
    onSave(documents.filter((d) => d.id !== id));

  const sorted = [...documents].sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0,
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Contracts, plans, photos, and any files for this lead.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFile}
        />
        <Button
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <FileText className="mr-2 h-4 w-4" />
          )}
          Upload Document
        </Button>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          No documents uploaded yet.
        </p>
      ) : (
        <div className="space-y-2">
          {sorted.map((doc) => (
            <div
              key={doc.id}
              className="rounded-md border p-3 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{doc.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatSize(doc.size)}
                    {doc.size ? " · " : ""}
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" asChild>
                  <a
                    href={documentSrc(doc.objectPath)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Download"
                  >
                    <Download className="h-4 w-4" />
                  </a>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => remove(doc.id)}
                  aria-label="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
