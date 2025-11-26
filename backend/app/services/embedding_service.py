"""
Embedding Service for Semantic Search

Uses OpenAI's text-embedding-3-small model to generate vector embeddings
for programs, enabling "search like a resident" functionality.

Example queries that will work:
- "swimming lessons" → finds "Aquatics Safety & Instruction"
- "where does money go for roads" → finds "Street Maintenance Program"
- "help for homeless" → finds "Housing Navigation", "Outreach Services"
"""

import logging
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import text
import uuid

from app.core.config import settings

logger = logging.getLogger(__name__)

# Check if OpenAI is available
OPENAI_AVAILABLE = False
openai_client = None

try:
    from openai import OpenAI
    if settings.OPENAI_API_KEY:
        openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)
        OPENAI_AVAILABLE = True
        logger.info("OpenAI client initialized for semantic search")
    else:
        logger.warning("OPENAI_API_KEY not set - semantic search disabled")
except ImportError:
    logger.warning("OpenAI package not installed - semantic search disabled")
except Exception as e:
    logger.warning(f"Failed to initialize OpenAI client: {e}")


# Embedding model configuration
EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIMENSIONS = 1536


def create_program_text(program: Dict[str, Any]) -> str:
    """
    Create searchable text from program fields.
    This text will be embedded for semantic matching.
    """
    parts = []
    
    # Program name is most important
    if program.get('name'):
        parts.append(program['name'])
    
    # Description provides context
    if program.get('description'):
        parts.append(program['description'])
    
    # Service type helps categorize
    if program.get('service_type'):
        parts.append(f"Service type: {program['service_type']}")
    
    # User group indicates who benefits
    if program.get('user_group'):
        parts.append(f"Serves: {program['user_group']}")
    
    return ". ".join(parts)


def generate_embedding(text: str) -> Optional[List[float]]:
    """
    Generate embedding vector for text using OpenAI.
    Returns None if OpenAI is not available.
    """
    if not OPENAI_AVAILABLE or not openai_client:
        return None
    
    try:
        response = openai_client.embeddings.create(
            input=text,
            model=EMBEDDING_MODEL
        )
        return response.data[0].embedding
    except Exception as e:
        logger.error(f"Failed to generate embedding: {e}")
        return None


def generate_embeddings_batch(texts: List[str]) -> List[Optional[List[float]]]:
    """
    Generate embeddings for multiple texts in a single API call.
    More efficient for bulk operations.
    """
    if not OPENAI_AVAILABLE or not openai_client:
        return [None] * len(texts)
    
    try:
        response = openai_client.embeddings.create(
            input=texts,
            model=EMBEDDING_MODEL
        )
        return [item.embedding for item in response.data]
    except Exception as e:
        logger.error(f"Failed to generate batch embeddings: {e}")
        return [None] * len(texts)


def embed_programs_for_dataset(db: Session, dataset_id: uuid.UUID) -> Dict[str, Any]:
    """
    Generate embeddings for all programs in a dataset.
    Called after data ingestion to enable semantic search.
    
    Returns statistics about the embedding process.
    """
    if not OPENAI_AVAILABLE:
        return {
            "success": False,
            "error": "OpenAI not available",
            "embedded_count": 0
        }
    
    from app.models.models import Program, ProgramEmbedding
    
    # Get all programs for this dataset
    programs = db.query(Program).filter(Program.dataset_id == dataset_id).all()
    
    if not programs:
        return {
            "success": True,
            "embedded_count": 0,
            "message": "No programs to embed"
        }
    
    # Prepare texts for batch embedding
    program_texts = []
    program_ids = []
    
    for program in programs:
        prog_text = create_program_text({
            'name': program.name,
            'description': program.description,
            'service_type': program.service_type,
            'user_group': program.user_group
        })
        program_texts.append(prog_text)
        program_ids.append(program.id)
    
    # Generate embeddings in batches of 100 (OpenAI limit is 2048)
    batch_size = 100
    embedded_count = 0
    errors = []
    
    for i in range(0, len(program_texts), batch_size):
        batch_texts = program_texts[i:i + batch_size]
        batch_ids = program_ids[i:i + batch_size]
        
        try:
            embeddings = generate_embeddings_batch(batch_texts)
            
            for j, (prog_id, embedding, prog_text) in enumerate(zip(batch_ids, embeddings, batch_texts)):
                if embedding is None:
                    errors.append(f"Failed to embed program {prog_id}")
                    continue
                
                # Check if embedding already exists
                existing = db.query(ProgramEmbedding).filter(
                    ProgramEmbedding.program_id == prog_id
                ).first()
                
                if existing:
                    # Update existing embedding using raw SQL for vector type
                    db.execute(
                        text("""
                            UPDATE program_embeddings 
                            SET embedding = :embedding, 
                                embedded_text = :prog_text,
                                updated_at = NOW()
                            WHERE program_id = :program_id
                        """),
                        {
                            "embedding": str(embedding),
                            "prog_text": prog_text[:1000],  # Truncate for storage
                            "program_id": prog_id
                        }
                    )
                else:
                    # Insert new embedding using raw SQL for vector type
                    db.execute(
                        text("""
                            INSERT INTO program_embeddings 
                            (dataset_id, program_id, embedding, embedded_text, created_at, updated_at)
                            VALUES (:dataset_id, :program_id, :embedding, :prog_text, NOW(), NOW())
                        """),
                        {
                            "dataset_id": str(dataset_id),
                            "program_id": prog_id,
                            "embedding": str(embedding),
                            "prog_text": prog_text[:1000]
                        }
                    )
                
                embedded_count += 1
            
            db.commit()
            
        except Exception as e:
            logger.error(f"Batch embedding failed: {e}")
            errors.append(str(e))
            db.rollback()
    
    return {
        "success": len(errors) == 0,
        "embedded_count": embedded_count,
        "total_programs": len(programs),
        "errors": errors if errors else None
    }


def semantic_search(
    db: Session, 
    dataset_id: uuid.UUID, 
    query: str, 
    limit: int = 20,
    similarity_threshold: float = 0.3
) -> List[Dict[str, Any]]:
    """
    Perform semantic search using vector similarity.
    
    Args:
        db: Database session
        dataset_id: Dataset to search within
        query: User's search query (natural language)
        limit: Maximum results to return
        similarity_threshold: Minimum cosine similarity (0-1)
    
    Returns:
        List of programs with similarity scores
    """
    if not OPENAI_AVAILABLE:
        return []
    
    # Generate embedding for the query
    query_embedding = generate_embedding(query)
    if query_embedding is None:
        return []
    
    try:
        # Use pgvector's cosine distance operator (<=>)
        # Lower distance = more similar, so we order ASC
        # Cosine similarity = 1 - cosine distance
        results = db.execute(
            text("""
                SELECT 
                    p.id,
                    p.name,
                    p.description,
                    p.service_type,
                    p.user_group,
                    p.quartile,
                    pc.total_cost,
                    pc.personnel,
                    pc.nonpersonnel,
                    pe.embedded_text,
                    1 - (pe.embedding <=> :query_embedding) as similarity
                FROM program_embeddings pe
                JOIN programs p ON pe.program_id = p.id
                LEFT JOIN program_costs pc ON p.id = pc.program_id
                WHERE pe.dataset_id = :dataset_id
                AND 1 - (pe.embedding <=> :query_embedding) > :threshold
                ORDER BY pe.embedding <=> :query_embedding
                LIMIT :limit
            """),
            {
                "query_embedding": str(query_embedding),
                "dataset_id": str(dataset_id),
                "threshold": similarity_threshold,
                "limit": limit
            }
        ).fetchall()
        
        return [
            {
                "id": row.id,
                "name": row.name,
                "description": row.description[:200] + "..." if row.description and len(row.description) > 200 else row.description,
                "serviceType": row.service_type,
                "userGroup": row.user_group,
                "quartile": row.quartile,
                "totalCost": float(row.total_cost) if row.total_cost else 0,
                "personnel": float(row.personnel) if row.personnel else 0,
                "nonpersonnel": float(row.nonpersonnel) if row.nonpersonnel else 0,
                "similarity": round(row.similarity, 3),
                "relevance": int(row.similarity * 100)  # 0-100 scale for UI
            }
            for row in results
        ]
        
    except Exception as e:
        logger.error(f"Semantic search failed: {e}")
        return []


def is_semantic_search_available() -> bool:
    """Check if semantic search is properly configured."""
    return OPENAI_AVAILABLE and openai_client is not None


def get_embedding_stats(db: Session, dataset_id: uuid.UUID) -> Dict[str, Any]:
    """Get statistics about embeddings for a dataset."""
    try:
        from app.models.models import Program, ProgramEmbedding
        
        total_programs = db.query(Program).filter(
            Program.dataset_id == dataset_id
        ).count()
        
        embedded_programs = db.query(ProgramEmbedding).filter(
            ProgramEmbedding.dataset_id == dataset_id
        ).count()
        
        return {
            "total_programs": total_programs,
            "embedded_programs": embedded_programs,
            "coverage_percent": round(embedded_programs / total_programs * 100, 1) if total_programs > 0 else 0,
            "semantic_search_available": is_semantic_search_available()
        }
    except Exception as e:
        return {
            "error": str(e),
            "semantic_search_available": is_semantic_search_available()
        }