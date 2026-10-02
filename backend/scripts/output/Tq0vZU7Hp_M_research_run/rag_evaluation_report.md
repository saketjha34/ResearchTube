# ResearchTube RAG System Evaluation & Benchmark Report

- **Target Video:** `Tq0vZU7Hp_M` (DevOps Full Course, ~5h 25m)
- **Embedding Model:** `text-embedding-3-small` (768 dimensions)
- **Evaluated On:** `2026-10-02 13:02:20 UTC`

## Overall Benchmark Scores

| Metric | Score | Target | Status |
| :--- | :--- | :--- | :--- |
| **Context Relevance** | `0.92 / 1.00` | `> 0.75` | ✅ Optimal |
| **Answer Faithfulness** | `0.89 / 1.00` | `> 0.90` | ⚠️ Hallucination Risk |
| **Answer Relevance** | `0.93 / 1.00` | `> 0.85` | ✅ Optimal |
| **Mean Retrieval Latency** | `812.00 ms` | `< 1500 ms` | ✅ Fast |

## Test Cases Breakdown

### Test 1: Topic Specific (Docker)
- **Query:** "What Docker commands are introduced and how does the container flow work?"
- **Latency:** `4144.98 ms` | **Chunks Retrieved:** `2`
- **Max Similarity:** `0.604` | **Avg Similarity:** `0.598`
- **Scores:** Context Relevance: `0.86` | Faithfulness: `0.96` | Answer Relevance: `0.78`
- **Judge Reasoning:** The retrieved chunks are clearly relevant to Docker architecture and container flow, but they do not include explicit command names. The answer is faithful because it correctly states that no specific Docker commands are shown and summarizes the container flow only using information present in the chunks. Answer relevance is moderately high since it addresses the flow well, but it only partially answers the command part by noting their absence rather than identifying any commands.

### Test 2: Architectural (Kubernetes)
- **Query:** "What core Kubernetes objects are covered and how is local Minikube set up?"
- **Latency:** `433.68 ms` | **Chunks Retrieved:** `2`
- **Max Similarity:** `0.554` | **Avg Similarity:** `0.55`
- **Scores:** Context Relevance: `0.98` | Faithfulness: `0.91` | Answer Relevance: `0.98`
- **Judge Reasoning:** The retrieved chunks directly mention the three core Kubernetes objects (Pod, Deployment, Service) and explain Minikube as a local, single-node Kubernetes cluster with control plane and worker node inside one VM. The answer is highly relevant and mostly faithful. The only slightly unsupported detail is the exact installation command: the chunk says 'just choco install and you'll do mini cube' but does not clearly provide the exact combined command `choco install minikube`.

### Test 3: Pipeline & Automation (CI/CD)
- **Query:** "What GitHub Actions workflow steps and triggers are demonstrated for CI/CD?"
- **Latency:** `344.43 ms` | **Chunks Retrieved:** `2`
- **Max Similarity:** `0.624` | **Avg Similarity:** `0.609`
- **Scores:** Context Relevance: `0.96` | Faithfulness: `0.83` | Answer Relevance: `0.98`
- **Judge Reasoning:** The retrieved chunks are highly relevant: they discuss push-triggered automation, build/test/check steps, ESLint, and a release/deploy job that depends on CI completing first. The answer mostly stays grounded in those chunks and directly addresses the question. Faithfulness is slightly reduced because it adds a bit of structure and interpretation beyond the exact wording in the references, though nothing major appears clearly false. The answer relevance is very high because it summarizes the demonstrated workflow steps and triggers clearly.

### Test 4: Source Control (Git)
- **Query:** "What Git branching and commit concepts are explained for beginners?"
- **Latency:** `249.98 ms` | **Chunks Retrieved:** `2`
- **Max Similarity:** `0.586` | **Avg Similarity:** `0.571`
- **Scores:** Context Relevance: `0.88` | Faithfulness: `0.9` | Answer Relevance: `0.97`
- **Judge Reasoning:** The retrieved chunks are strongly relevant: they directly discuss basic Git commands, commit messages, and upcoming branching topics. The generated answer is largely faithful and answers the beginner-focused question well. A couple phrases add mild interpretation or organization beyond the exact wording of the chunks, but there is no major hallucination. The answer relevance is very high because it clearly summarizes beginner branching/commit-related concepts and mentions the branching strategy preview.

### Test 5: Broad Video Overview
- **Query:** "Can you give me a full overview and roadmap of this complete video?"
- **Latency:** `254.25 ms` | **Chunks Retrieved:** `2`
- **Max Similarity:** `0.507` | **Avg Similarity:** `0.489`
- **Scores:** Context Relevance: `0.93` | Faithfulness: `0.84` | Answer Relevance: `0.96`
- **Judge Reasoning:** The retrieved chunks are highly relevant because they explicitly describe the video as Part 1 of a DevOps practical course and list the topics covered in this part, along with references to Part 2 and Part 3. The generated answer closely matches those details and directly answers the request for an overview/roadmap. Faithfulness is slightly reduced because it frames the series as a complete DevOps course and infers that Part 2/3 contain the remaining topics, which is not fully explicit in the provided text. Overall, the answer is strong and directly useful, with only minor overreach.

### Test 6: Conversational Guardrail
- **Query:** "Hello, good morning! How are you today?"
- **Latency:** `0.73 ms` | **Chunks Retrieved:** `0`
- **Max Similarity:** `0.0` | **Avg Similarity:** `0.0`
- **Scores:** Context Relevance: `1.0` | Faithfulness: `1.0` | Answer Relevance: `1.0`
- **Judge Reasoning:** Guardrail triggered: skipped RAG retrieval as intended.

### Test 7: Out-of-Domain Guardrail
- **Query:** "How do I bake a triple-layer chocolate birthday cake?"
- **Latency:** `255.95 ms` | **Chunks Retrieved:** `0`
- **Max Similarity:** `0.0` | **Avg Similarity:** `0.0`
- **Scores:** Context Relevance: `1.0` | Faithfulness: `1.0` | Answer Relevance: `0.8`
- **Judge Reasoning:** Guardrail triggered: skipped RAG retrieval as intended.

