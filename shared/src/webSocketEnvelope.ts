import type { EventFromBackend } from "./eventFromBackend";

/** Frontend to backend: one request that gets exactly one response. */
export interface RequestEnvelope {
  correlationIdentifier: string;
  message: string;
  data: Record<string, unknown>;
}

export interface ResponseSuccessEnvelope {
  correlationIdentifier: string;
  result: unknown;
}

export interface ResponseErrorEnvelope {
  correlationIdentifier: string;
  error: { code: string; message: string };
}

export interface EventEnvelope {
  event: EventFromBackend;
}

export type FrameFromBackend = ResponseSuccessEnvelope | ResponseErrorEnvelope | EventEnvelope;

export function isEventEnvelope(frame: FrameFromBackend): frame is EventEnvelope {
  return "event" in frame;
}

export function isResponseErrorEnvelope(frame: FrameFromBackend): frame is ResponseErrorEnvelope {
  return "error" in frame;
}
