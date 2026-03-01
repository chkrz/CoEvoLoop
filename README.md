# CoEvoLoop

This repository contains the source code for our ACL 2026 System Demo paper. CoEvoLoop is a platform designed to facilitate the co-evolution of data and models through interactive synthesis, annotation, and reinforcement learning loops.

> **Note:** This open-source version is a simplified implementation of our internal system. While it captures the core methodologies and workflows described in our paper, some enterprise-specific features and scalable infrastructure components have been omitted or streamlined for ease of deployment and demonstration purposes.

## 🎬 Demo Video

[![CoEvoLoop Demo](https://img.youtube.com/vi/1rdYXjRDgoQ/0.jpg)](https://youtu.be/1rdYXjRDgoQ)

Watch the full demo: https://youtu.be/1rdYXjRDgoQ

## 📄 License

This project is licensed under the [MIT License](LICENSE).

## 🚀 Getting Started

### Prerequisites

- **Python 3.10+**: Managed via [Poetry](https://python-poetry.org/).
- **Node.js**: Required for the frontend interface.

### Installation

1.  **Clone the repository:**
    ```bash
    git clone <repository_url>
    cd <repository_name>
    ```

2.  **Install Backend Dependencies:**
    Make sure you have Poetry installed.
    ```bash
    poetry install
    ```

3.  **Install Frontend Dependencies:**
    Navigate to the viewer directory and install dependencies.
    ```bash
    cd viewer
    npm install
    # or if you use bun
    # bun install
    cd ..
    ```

## 🧩 Core Modules

The system is composed of five key functional modules:

### 1. Dataset Management
Centralized storage and management for conversation datasets. It supports importing/exporting JSON/JSONL files and tracking data versions, serving as the foundation for the co-evolution loop.

### 2. Synthesis & Evaluation
An automated pipeline where agent-based user simulators interact with assistant models to generate synthetic dialogue data. This module also includes automated evaluation metrics to assess the quality of generated conversations.

### 3. Model Playground
An interactive environment designed to evaluate trained models. It supports **Manual Mode**, where you can chat directly with the model to test specific queries, and **Auto Mode**, which visualizes real-time interactions between the trained model and a User Simulator agent, allowing you to observe autonomous model behaviors. 

### 4. RL Inspection
A visualization dashboard for Reinforcement Learning (RL) trading debug. It provides insights into reward trends, rollout comparison, and other key metrics from the RL training logs.

### 5. Data Annotation
A human-in-the-loop component that enables annotators to review, correct, and rate model outputs. The annotation workflow operates on a **file-based working copy** architecture so that the original dataset is never mutated.

**Workflow**
1. When a dataset is opened for annotation, the system creates a timestamped JSONL working copy under `backend/storage/annotation_working_copies/` (e.g. `{dataset_id}_annotated_copy_{timestamp}.jsonl`).
2. Each item in the copy receives a globally unique annotation ID via `AnnotationIdGenerator`, formatted as `ann_{dataset_id}_{timestamp}_{uuid}_{sequence}`.
3. Annotators write their edits (corrections, ratings, tags, notes) into the `edited_content` field alongside the immutable `original_content`.
4. Annotation progress and per-dataset statistics are tracked in `copies_metadata.json` by `AnnotationMetadataManager`.

**Supported data types and metrics**

| Data Type | Description | Metrics computed |
|---|---|---|
| `EVALUATION` | Quality evaluation results produced by an LLM judge | `assistant_model_score` — ratio of samples where *all* evaluation dimensions (fields ending in `评分`) received a score of 1; `kappa_score` — dimension-level agreement rate between the original model judgment and the human annotator's corrections |
| `DIALOGUE` | Synthesised conversation data | Metrics TBD (`turing_score`, `kappa_score`, `assistant_model_score` all return `-1` for now) |

High-quality human annotations are fed back into the synthesis and training pipelines to drive the co-evolution loop.

## ⚙️ Configuration

### 1. Environment Variables

Create a `.env` file in the root directory to store your sensitive configuration, specifically your API keys for the LLM providers you intend to use.

```bash
# Example .env file content
OPENAI_API_KEY=your_openai_api_key
DASHSCOPE_API_KEY=your_dashscope_api_key
GOOGLE_API_KEY=your_google_api_key
```

### 2. Model Configuration (LiteLLM)

The system supports two ways to specify which LLM to use:

#### Option A: Direct Provider/Model Pattern (Recommended)

You can skip `config/models.json` and directly use the `provider/model_name` format when specifying models in the system.

Examples:
*   `openai/gpt-4o`
*   `dashscope/qwen-max`
*   `google/gemini-pro`

In this mode, `models.json` is not required. The system will verify the provider prefix and attempt to load the matching API Key (e.g., `OPENAI_API_KEY`) from your environment variables automatically.

#### Option B: Configuration Mapping

Alternatively, you can define model aliases in `config/models.json`. This allows you to use simplified names (e.g., `gpt-4o`, `qwen-plus`) throughout the system, which are then mapped to specific providers and configurations.

**File:** [config/models.json](config/models.json)

```json
{
  "models": {
    "qwen3-235b-a22b": {
      "provider": "DASHSCOPE"
    },
    "gpt-4o": {
      "provider": "openai"
    }
  }
}
```

*   **Key**: The model identifier used in the system.
*   **Provider**: The vendor (e.g., `openai`, `dashscope`, `google`).

Ensure that the corresponding API keys for your chosen providers are set in your `.env` file.

## 🏃‍♂️ Usage

### Starting the Server

We provide a helper script to launch both the backend (Django) and frontend (Vite) servers simultaneously.

```bash
chmod +x start_server.sh
./start_server.sh
```

This script will:
1.  Check for necessary tools (Poetry, npm).
2.  Start the Django backend server.
3.  Start the Vite frontend development server.
4.  Start TensorBoard for monitoring RL logs.

Once started, access the web interface at the URL provided in the terminal (typically `http://localhost:5173` or `http://localhost:8000`).

### Example Data

To help you get started, we have provided example datasets in the `backend/resource/` directory:

*   [backend/resource/messages.jsonl](backend/resource/messages.jsonl): Sample conversation data which could be used for portrait extraction.
*   [backend/resource/user.jsonl](backend/resource/user.jsonl): Sample user profile data.
*   [backend/resource/sysdemo-rl-log-step10.jsonl](backend/resource/sysdemo-rl-log-step10.jsonl): Sample RL training log containing the first 10 steps. This file can be uploaded directly to the **RL Inspection** module to visualize reward trends, rollout comparisons, and per-dimension evaluation scores.

You can use these files to test the annotation, synthesis, and RL inspection workflows immediately after installation.

## 🌐 Frontend Language

The frontend UI is written in **Chinese** to match the requirements of the target user base. If you need to use the interface in another language, we recommend installing a browser translation extension (e.g. Google Translate for Chrome, or the built-in translation feature in Microsoft Edge) and enabling automatic page translation.

## 🤝 Contributing

We welcome contributions! Please feel free to submit a Pull Request.
