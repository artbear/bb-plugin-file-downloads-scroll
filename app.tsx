import { useLayoutEffect, useRef, useState } from "react";
import { definePluginApp, useRpc } from "@get-bb/plugin-sdk/app";
import type {
  PluginFileOpenerProps,
  PluginFileOpenerSource,
} from "@get-bb/plugin-sdk/app";
import type { rpcContract } from "./server";
import { Button } from "./components/ui/button";
import { Icon } from "./components/ui/icon";
import { saveDownload } from "./browser-download";

function DownloadActions({ path, source }: {
  path: string;
  source: PluginFileOpenerSource;
}) {
  const rpc = useRpc<typeof rpcContract>();
  const [pending, setPending] = useState<"file" | "zip" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const mounted = useRef(true);

  useLayoutEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  async function download(format: "file" | "zip") {
    // Also block clicks delivered before React commits disabled buttons.
    if (busy.current || !mounted.current) return;
    busy.current = true;
    setPending(format);
    setError(null);
    try {
      const result = await rpc.call("downloads_create", { path, source, format });
      if (!mounted.current) return;
      await saveDownload(result);
    } catch (cause) {
      if (mounted.current) {
        const detail = cause instanceof Error ? cause.message : String(cause);
        setError(`Не удалось скачать файл: ${detail}`);
      }
    } finally {
      if (mounted.current) {
        busy.current = false;
        setPending(null);
      }
    }
  }

  return (
    <div className="shrink-0 border-b border-border px-3 py-2">
      <div role="group" aria-label="Скачивание файла" aria-busy={pending !== null}
        className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" disabled={pending !== null}
          onClick={() => void download("file")}>
          <Icon name="Download" aria-hidden="true" />
          Скачать файл
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={pending !== null}
          onClick={() => void download("zip")}>
          <Icon name="Archive" aria-hidden="true" />
          Скачать ZIP
        </Button>
        <span role="status" className="text-xs text-muted-foreground">
          {pending === "zip" ? "Подготовка ZIP…" : pending === "file" ? "Подготовка файла…" : ""}
        </span>
      </div>
      {error === null ? null : (
        <p role="alert" className="mt-2 break-words text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}

function MarkdownDownloads({ path, source, Original }: PluginFileOpenerProps) {
  // Remount only actions on file changes; line targets keep Original intact.
  const fileKey = JSON.stringify([
    path, source.kind, source.threadId, source.environmentId,
    source.projectId, source.experimental_hostId ?? null,
  ]);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <DownloadActions key={fileKey} path={path} source={source} />
      <div className="min-h-0 flex-1 overflow-y-auto"><Original /></div>
    </div>
  );
}

export default definePluginApp((app) => {
  app.slots.fileOpener({
    id: "markdown-downloads",
    title: "Markdown со скачиванием",
    extensions: ["md", "markdown", "mdown"],
    component: MarkdownDownloads,
  });
});
