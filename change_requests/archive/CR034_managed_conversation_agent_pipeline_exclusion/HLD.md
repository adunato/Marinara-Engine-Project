# CR034: Managed Conversation Agent Pipeline Exclusion

## Status

In progress.

## Goal

Ensure Daily Conversation Memories and Daily Intentions use only their dedicated Conversation runtimes and never enter the generic LLM agent batch during normal message generation.

## Problem

Phoenix traces show both managed agents being included in a generic two-agent batch on consecutive turns. This bypasses Daily Memory's completed-day guard and sends Daily Intentions as an empty task, wasting LLM calls and producing redundant outputs.

## Proposed solution

Make the generic pipeline exclusion for built-in agents with `execution: "managed"` authoritative at runtime, including generated/built artifacts. Add a focused regression check for agent resolution so managed agent IDs cannot be returned as pipeline agents.

## Risks

The change must retain the separate native Daily Memory formation/retrieval and Daily Intentions injection paths. It must not affect ordinary pipeline agents or custom agents.

## Validation

Run focused server regression coverage and a production build. Confirm a post-restart Phoenix trace does not contain either managed agent in a generic batch.
