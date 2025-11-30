"""Simple RAG client using Qdrant and Gemini embeddings."""
from __future__ import annotations

import os
from typing import Iterable

from google import genai
from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels

DEFAULT_COLLECTION = os.getenv("QDRANT_COLLECTION", "incidents")
QDRANT_URL = os.getenv("QDRANT_URL", "http://qdrant:6333")


def _embed(texts: Iterable[str]) -> list[list[float]]:
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        return [[0.0] * 3 for _ in texts]  # trivial fallback to stable shape

    client = genai.Client(api_key=api_key)
    out: list[list[float]] = []
    for t in texts:
        resp = client.models.embed_content(
            model="text-embedding-004",  # free-friendly embedding model
            content=t[:3000],
        )
        out.append(resp.embeddings[0].values)
    return out


def _client() -> QdrantClient:
    return QdrantClient(url=QDRANT_URL)


def ensure_collection(dim: int) -> None:
    client = _client()
    try:
        client.get_collection(DEFAULT_COLLECTION)
        return
    except Exception:
        pass
    client.recreate_collection(
        collection_name=DEFAULT_COLLECTION,
        vectors_config=qmodels.VectorParams(size=dim, distance=qmodels.Distance.COSINE),
    )


def query_similar(text: str, top_k: int = 5) -> list[str]:
    vectors = _embed([text])
    if not vectors:
        return []
    dim = len(vectors[0])
    ensure_collection(dim)
    client = _client()
    res = client.search(
        collection_name=DEFAULT_COLLECTION,
        query_vector=vectors[0],
        with_payload=True,
        limit=top_k,
    )
    return [str(p.payload.get("summary", "")) for p in res if p.payload]


def upsert_summary(doc_id: str, text: str, labels: dict[str, str] | None = None) -> None:
    vectors = _embed([text])
    if not vectors:
        return
    dim = len(vectors[0])
    ensure_collection(dim)
    client = _client()
    client.upsert(
        collection_name=DEFAULT_COLLECTION,
        points=[
            qmodels.PointStruct(
                id=doc_id,
                vector=vectors[0],
                payload={"summary": text, **(labels or {})},
            )
        ],
    )

