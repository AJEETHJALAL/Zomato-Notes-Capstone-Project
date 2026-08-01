from typing import List, Dict, Any
from sentence_transformers import SentenceTransformer
import numpy as np

_model: SentenceTransformer | None = None


def load_embedding_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


def embed_texts(texts: List[str]) -> List[List[float]]:
    model = load_embedding_model()
    return model.encode(texts, convert_to_numpy=True).tolist()


def cosine_similarity(a: List[float], b: List[float]) -> float:
    a_arr = np.array(a, dtype=float)
    b_arr = np.array(b, dtype=float)
    if np.linalg.norm(a_arr) == 0 or np.linalg.norm(b_arr) == 0:
        return 0.0
    return float(np.dot(a_arr, b_arr) / (np.linalg.norm(a_arr) * np.linalg.norm(b_arr)))


def rank_notes_by_similarity(notes: List[Dict[str, Any]], query: str) -> List[Dict[str, Any]]:
    contents = [note["content"] for note in notes]
    embeddings = embed_texts(contents)
    query_embedding = embed_texts([query])[0]
    scored = []
    for note, emb in zip(notes, embeddings):
        score = cosine_similarity(query_embedding, emb)
        scored.append({**note, "score": score})
    scored.sort(key=lambda item: item["score"], reverse=True)
    return scored
