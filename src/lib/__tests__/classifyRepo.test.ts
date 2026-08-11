import { describe, it, expect } from "vitest";
import { classifyRepo } from "@/lib/classifyRepo";
import { sanitizeFormValue } from "@/lib/formatters";
import { parseOwnerRepo } from "@/lib/github";

describe("classifyRepo", () => {
  it("classifies a docker-compose repo as Tier 4", () => {
    const r = classifyRepo(["docker-compose.yml", "web/Dockerfile", "db/init.sql"]);
    expect(r.classification.tier).toBe("Tier 4");
    expect(r.classification.confidence).toBe("high");
  });

  it("classifies a plain Dockerfile as Tier 2", () => {
    const r = classifyRepo(["Dockerfile", "README.md", "app.py"]);
    expect(r.classification.tier).toBe("Tier 2");
  });

  it("classifies a CUDA Dockerfile as Tier 3", () => {
    const r = classifyRepo(["Dockerfile"], {
      contentSnippets: ["FROM nvidia/cuda:12.2-runtime\nRUN pip install torch"],
    });
    expect(r.classification.tier).toBe("Tier 3");
  });

  it("classifies a Python repo as Tier 1 with an entry file", () => {
    const r = classifyRepo(["requirements.txt", "main.py", "README.md"]);
    expect(r.classification.tier).toBe("Tier 1");
    expect(r.classification.entryFile).toBe("main.py");
  });

  it("classifies a Node repo as Tier 1", () => {
    const r = classifyRepo(["package.json", "index.js"]);
    expect(r.classification.tier).toBe("Tier 1");
    expect(r.classification.entryFile).toBe("index.js");
  });

  it("marks conflicting Python+Node as low confidence", () => {
    const r = classifyRepo(["requirements.txt", "package.json"]);
    expect(r.classification.confidence).toBe("low");
  });

  it("returns Unsupported with low confidence for an empty repo", () => {
    const r = classifyRepo(["README.md"]);
    expect(r.classification.tier).toBe("Unsupported");
    expect(r.classification.confidence).toBe("low");
  });

  it("detects agent-repo signals from langchain import", () => {
    const r = classifyRepo(["requirements.txt", "main.py"], {
      contentSnippets: ["from langchain.chat_models import ChatOpenAI"],
    });
    expect(r.agent.isAgentRepo).toBe(true);
  });

  it("detects secret env-var patterns", () => {
    const r = classifyRepo(["main.py"], {
      contentSnippets: ['api_key = os.environ.get("OPENAI_API_KEY")'],
    });
    expect(r.agent.secrets).toContain("OPENAI_API_KEY");
  });

  it("flags long-running repos (FastAPI)", () => {
    const r = classifyRepo(["requirements.txt", "app.py"], {
      contentSnippets: ["from fastapi import FastAPI\napp = FastAPI()"],
    });
    expect(r.agent.longRunning).toBe(true);
  });
});

describe("sanitizeFormValue", () => {
  it("strips surrounding quotes (Windows Copy as path)", () => {
    expect(sanitizeFormValue('"C:\\path\\to\\file"')).toBe("C:\\path\\to\\file");
    expect(sanitizeFormValue("'value'")).toBe("value");
  });
  it("trims whitespace", () => {
    expect(sanitizeFormValue("  hi  ")).toBe("hi");
  });
});

describe("parseOwnerRepo", () => {
  it("parses bare owner/repo", () => {
    expect(parseOwnerRepo("owner/repo")).toEqual({ owner: "owner", repo: "repo" });
  });
  it("parses full github URL", () => {
    expect(parseOwnerRepo("https://github.com/owner/repo")).toEqual({
      owner: "owner",
      repo: "repo",
    });
  });
  it("rejects non-repo input", () => {
    expect(parseOwnerRepo("just some search query")).toBeNull();
  });
});
