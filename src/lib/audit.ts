import { db, auth } from "./firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { AuditLog } from "../types";

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType | string;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType | string, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function logAction(params: {
  action: AuditLog["action"];
  entityType: AuditLog["entityType"];
  entityId: string;
  entityName?: string;
  details?: string;
}) {
  const user = auth.currentUser;
  if (!user) return;

  try {
    await addDoc(collection(db, "auditLogs"), {
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      entityName: params.entityName || "",
      details: params.details || "",
      userId: user.uid,
      userEmail: user.email || "unknown",
      timestamp: new Date().toISOString(), 
      serverTime: serverTimestamp() 
    });
  } catch (error) {
    console.error("Failed to log action:", error);
  }
}
