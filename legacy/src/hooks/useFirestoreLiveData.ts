import { useEffect, useState } from 'react';
import {
  DocumentReference,
  Query,
  QueryDocumentSnapshot,
  DocumentData,
  onSnapshot,
} from 'firebase/firestore';

export function useFirestoreCollectionData<T>(
  buildQuery: () => Query<DocumentData> | null,
  deps: any[] = [],
  mapDoc?: (docSnap: QueryDocumentSnapshot<DocumentData>) => T,
): T[] {
  const [data, setData] = useState<T[]>([]);

  useEffect(() => {
    const nextQuery = buildQuery();
    if (!nextQuery) {
      setData([]);
      return;
    }

    return onSnapshot(
      nextQuery,
      (snapshot) => {
        const items = snapshot.docs.map((docSnap) => (
          mapDoc
            ? mapDoc(docSnap)
            : ({ id: docSnap.id, ...docSnap.data() } as T)
        ));
        setData(items);
      },
      (error) => {
        console.error('[useFirestoreCollectionData] Error:', error);
        setData([]);
      },
    );
  }, deps);

  return data;
}

export function useFirestoreDocumentData<T>(
  buildRef: () => DocumentReference<DocumentData> | null,
  deps: any[] = [],
  mapDoc?: (data: DocumentData, id: string) => T,
): T | null {
  const [data, setData] = useState<T | null>(null);

  useEffect(() => {
    const nextRef = buildRef();
    if (!nextRef) {
      setData(null);
      return;
    }

    return onSnapshot(
      nextRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setData(null);
          return;
        }

        const snapshotData = snapshot.data();
        setData(
          mapDoc
            ? mapDoc(snapshotData, snapshot.id)
            : ({ id: snapshot.id, ...snapshotData } as T),
        );
      },
      (error) => {
        console.error('[useFirestoreDocumentData] Error:', error);
        setData(null);
      },
    );
  }, deps);

  return data;
}
