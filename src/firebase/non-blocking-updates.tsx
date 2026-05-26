
'use client';
    
import {
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  CollectionReference,
  DocumentReference,
  SetOptions,
  serverTimestamp,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import {FirestorePermissionError} from '@/firebase/errors';

/**
 * Initiates a setDoc operation for a document reference.
 * Does NOT await the write operation internally.
 */
export function setDocumentNonBlocking(docRef: DocumentReference, data: any, options: SetOptions) {
  const dataWithTimestamp = { ...data, updatedAt: serverTimestamp() };
  // firebase v12 narrowed SetOptions to a discriminated union of `{ merge }`
  // and `{ mergeFields }`; check via `in` rather than property access.
  const isMerge = 'merge' in options
    ? (options as { merge?: boolean }).merge === true
    : 'mergeFields' in options;
  if (isMerge) {
    // For merge updates, we only set updatedAt
    setDoc(docRef, dataWithTimestamp, options).catch(error => {
      errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({
          path: docRef.path,
          operation: 'update',
          requestResourceData: dataWithTimestamp,
        })
      )
    })
  } else {
    // For overwrites, we also set createdAt
    const finalData = { ...dataWithTimestamp, createdAt: serverTimestamp() };
    setDoc(docRef, finalData, options).catch(error => {
      errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({
          path: docRef.path,
          operation: 'create',
          requestResourceData: finalData,
        })
      )
    })
  }
}


/**
 * Initiates an addDoc operation for a collection reference.
 * Does NOT await the write operation internally.
 * Returns the Promise for the new doc ref, but typically not awaited by caller.
 */
export function addDocumentNonBlocking(colRef: CollectionReference, data: any) {
  const dataWithTimestamps = {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const promise = addDoc(colRef, dataWithTimestamps)
    .catch(error => {
      errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({
          path: colRef.path,
          operation: 'create',
          requestResourceData: dataWithTimestamps,
        })
      )
    });
  return promise;
}


/**
 * Initiates an updateDoc operation for a document reference.
 * Does NOT await the write operation internally.
 */
export function updateDocumentNonBlocking(docRef: DocumentReference, data: any) {
  const dataWithTimestamp = { ...data, updatedAt: serverTimestamp() };
  updateDoc(docRef, dataWithTimestamp)
    .catch(error => {
      errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({
          path: docRef.path,
          operation: 'update',
          requestResourceData: dataWithTimestamp,
        })
      )
    });
}


/**
 * Initiates a deleteDoc operation for a document reference.
 * Does NOT await the write operation internally.
 */
export function deleteDocumentNonBlocking(docRef: DocumentReference) {
  deleteDoc(docRef)
    .catch(error => {
      errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({
          path: docRef.path,
          operation: 'delete',
        })
      )
    });
}
