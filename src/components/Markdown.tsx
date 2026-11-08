import { useEffect, useId, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function Diagram({ source }: { source: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [svg, setSvg] = useState("");
  useEffect(() => {
    let cancelled = false;
    setSvg("");
    void import("mermaid").then(async ({ default: mermaid }) => {
      mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "dark" });
      const result = await mermaid.render(`diagram${id}`, source);
      if (!cancelled) setSvg(result.svg);
    }).catch(() => { if (!cancelled) setSvg(""); });
    return () => { cancelled = true; };
  }, [id, source]);
  return svg ? <div className="overflow-x-auto" dangerouslySetInnerHTML={{ __html: svg }} /> : <pre className="overflow-x-auto"><code>{source}</code></pre>;
}

export function Markdown({ children }: { children: string }) {
  return <div className="markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{
    code({ className, children, ...props }) {
      if (className?.includes("language-mermaid")) return <Diagram source={String(children).replace(/\n$/, "")} />;
      return <code className={className} {...props}>{children}</code>;
    },
  }}>{children}</ReactMarkdown></div>;
}
