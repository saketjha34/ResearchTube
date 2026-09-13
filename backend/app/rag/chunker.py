"""
Text Chunker powered by LangChain.

Splits arbitrary text documents into semantically coherent overlapping chunks.
Uses LangChain's RecursiveCharacterTextSplitter to respect natural language
boundaries (paragraphs, sentences, words) rather than naive character slicing.
"""

from __future__ import annotations

# pyrefly: ignore [missing-import]
from langchain_text_splitters import RecursiveCharacterTextSplitter


class TextChunker:
    """
    Configurable text chunker powered by LangChain's RecursiveCharacterTextSplitter.

    Usage:
        chunker = TextChunker(chunk_size=1000, chunk_overlap=200)
        chunks = chunker.split_text("Long transcript or document text...")
    """

    def __init__(
        self,
        chunk_size: int = 1000,
        chunk_overlap: int = 200,
        separators: list[str] | None = None,
    ) -> None:
        if chunk_size <= 0:
            raise ValueError("chunk_size must be greater than 0.")
        if chunk_overlap < 0:
            raise ValueError("chunk_overlap cannot be negative.")
        if chunk_overlap >= chunk_size:
            raise ValueError("chunk_overlap must be smaller than chunk_size.")

        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.separators = separators or ["\n\n", "\n", " ", ""]

        self._splitter = RecursiveCharacterTextSplitter(
            chunk_size=self.chunk_size,
            chunk_overlap=self.chunk_overlap,
            separators=self.separators,
            length_function=len,
            is_separator_regex=False,
            strip_whitespace=True,
        )

    def split_text(self, text: str) -> list[str]:
        """
        Split raw text into semantically coherent overlapping chunks.
        Returns an empty list if text is empty or only whitespace.
        """
        if not text or not text.strip():
            return []

        return self._splitter.split_text(text)


def chunk_text(
    text: str,
    chunk_size: int = 1000,
    chunk_overlap: int = 200,
) -> list[str]:
    """
    Convenience function to split text using LangChain's RecursiveCharacterTextSplitter.

    Parameters
    ----------
    text:
        Raw input string to chunk (e.g. video transcript or document).
    chunk_size:
        Target character count per chunk (default 1000).
    chunk_overlap:
        Character overlap between consecutive chunks (default 200).

    Returns
    -------
    list[str]:
        List of cleaned chunk strings.
    """
    chunker = TextChunker(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    return chunker.split_text(text)