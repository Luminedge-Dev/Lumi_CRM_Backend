import { Request, Response, NextFunction } from 'express';

// NoSQL operator injection guard. Express's extended query parser and express.json both turn
// `?status[$ne]=x` / `{"status":{"$ne":"x"}}` into real objects, and several controllers pass
// req.query/req.body values straight into Mongoose filters. Any value that carries a `$`-prefixed
// key (recursively) is dropped entirely, so the field behaves as if it was never sent. No
// legitimate client payload uses `$` keys.
// Keys that can reach Object.prototype when a payload is merged/spread into another object
// (prototype pollution). JSON.parse creates them as ordinary own keys, so they are removed too.
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const hasOperatorKey = (obj: Record<string, unknown>): boolean => Object.keys(obj).some((k) => k.startsWith('$'));

const scrub = (value: unknown): void => {
  if (Array.isArray(value)) {
    for (let i = value.length - 1; i >= 0; i--) {
      const item = value[i];
      if (item && typeof item === 'object' && !Array.isArray(item) && hasOperatorKey(item as Record<string, unknown>)) {
        value.splice(i, 1);
      } else {
        scrub(item);
      }
    }
    return;
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      const child = obj[key];
      if (key.startsWith('$') || FORBIDDEN_KEYS.has(key)) {
        delete obj[key];
      } else if (child && typeof child === 'object' && !Array.isArray(child) && hasOperatorKey(child as Record<string, unknown>)) {
        delete obj[key];
      } else {
        scrub(child);
      }
    }
  }
};

export const sanitizeInput = (req: Request, _res: Response, next: NextFunction): void => {
  scrub(req.body);
  scrub(req.query);
  scrub(req.params);
  next();
};
