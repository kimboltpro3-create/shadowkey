# Claude SDK + ShadowKey Example

A travel booking AI agent powered by **Claude claude-opus-4-6** that requests access to a user's ShadowKey privacy vault — giving the user field-level control over what data the agent can see.

## What it demonstrates

1. Claude determines which vault fields are needed for a task
2. ShadowKey SDK creates a pending access request (requires user approval)
3. User approves per-field in the ShadowKey dashboard
4. Claude completes the task using only field metadata — **actual secrets never reach the LLM**

## Setup

```bash
npm install

export SUPABASE_URL="https://your-project.supabase.co"
export SHADOWKEY_API_KEY="sk-..."        # From ShadowKey Settings page
export ANTHROPIC_API_KEY="sk-ant-..."   # From console.anthropic.com

npm start
```

## Privacy guarantee

The agent sends **only field names** (e.g. `["passport_number", "card_number"]`) to Claude — never the actual values. Your application processes the real vault data locally to call booking APIs, keeping sensitive information out of the LLM context entirely.

## Related examples

- [`../openrouter/`](../openrouter/) — Shopping agent using OpenRouter (free models)
- [`../node-express/`](../node-express/) — REST API server exposing ShadowKey access
