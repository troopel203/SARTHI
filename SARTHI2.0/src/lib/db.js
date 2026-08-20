// SARTHI backend facade.
//
// Every page imports data functions from "../lib/db" and never cares which
// backend is actually running. Demo mode (no Supabase env vars) uses the
// in-browser localDb. Set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY in
// .env and the exact same function calls transparently hit real Postgres
// with real Auth-scoped RLS and real cross-device Realtime — no other code
// changes needed anywhere in src/pages or src/components.

import { isSupabaseConfigured } from "./supabaseClient";
import * as local from "./localDb";
import * as remote from "./supabaseDb";

export const backendMode = isSupabaseConfigured ? "production" : "demo";

const impl = isSupabaseConfigured ? remote : local;

export const loadState = local.loadState; // demo-only bootstrap; no-op concept in production (init() runs on auth)
export const getState = impl.getState;
export const subscribe = impl.subscribe;
export const resetDemo = impl.resetDemo;
export const getReferral = impl.getReferral;
export const createReferral = impl.createReferral;
export const escalateReferral = impl.escalateReferral;
export const respondToReferral = impl.respondToReferral;
export const simulateResourceLoss = impl.simulateResourceLoss;
export const reportConditionDeterioration = impl.reportConditionDeterioration;
export const markArrived = impl.markArrived;
export const completeReferral = impl.completeReferral;
export const updateHospitalResources = impl.updateHospitalResources;
export const startEngine = impl.startEngine;
export const findUser = local.findUser; // demo-mode account picker only
export const setCurrentUser = impl.setCurrentUser;
