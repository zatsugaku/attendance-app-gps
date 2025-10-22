import Anthropic from '@anthropic-ai/sdk';
import { Octokit } from '@octokit/rest';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const OWNER = process.env.GITHUB_REPOSITORY?.split('/')[0] || 'zatsugaku';
const REPO = process.env.GITHUB_REPOSITORY?.split('/')[1] || 'office-timecard-system';

/**
 * CoordinatorAgent - タスク統括・並列実行制御
 *
 * 役割:
 * 1. Issueの内容を分析
 * 2. タスクを分解してDAG（有向非巡回グラフ）を作成
 * 3. Critical Pathを特定
 * 4. 実行プランを作成
 */
export async function coordinatorAgent(issueNumber, issueTitle, issueBody) {
  console.log(`[CoordinatorAgent] Analyzing Issue #${issueNumber}: ${issueTitle}`);

  const analysisPrompt = `あなたはCoordinatorAgentです。以下のGitHub Issueを分析し、実行プランを作成してください。

## Issue情報
- Issue番号: #${issueNumber}
- タイトル: ${issueTitle}
- 内容:
${issueBody}

## タスク
1. このIssueで実装すべき内容を分析
2. 必要なファイル操作をリストアップ
3. 実行ステップを順序立てて出力

## 出力形式（JSON）
{
  "summary": "タスクの概要",
  "complexity": "small|medium|large",
  "estimatedTokens": 50000,
  "steps": [
    {
      "id": 1,
      "description": "ステップの説明",
      "files": ["対象ファイルのパス"],
      "agent": "codegen|review"
    }
  ]
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: analysisPrompt
      }]
    });

    const analysisText = response.content[0].text;
    console.log('[CoordinatorAgent] Analysis:', analysisText);

    // JSONを抽出（```json ... ``` の中身）
    const jsonMatch = analysisText.match(/```json\n([\s\S]*?)\n```/);
    const plan = jsonMatch ? JSON.parse(jsonMatch[1]) : JSON.parse(analysisText);

    // Issueにコメントを追加
    await octokit.issues.createComment({
      owner: OWNER,
      repo: REPO,
      issue_number: issueNumber,
      body: `## 🎯 CoordinatorAgent - 実行プラン

**タスク概要**: ${plan.summary}
**複雑度**: ${plan.complexity}
**推定トークン**: ${plan.estimatedTokens.toLocaleString()}

### 実行ステップ

${plan.steps.map((step, i) => `
${i + 1}. **${step.description}**
   - Agent: ${step.agent}
   - 対象ファイル: ${step.files.join(', ')}
`).join('\n')}

次のステップ: CodeGenAgentを実行します...

🌸 Miyabi - CoordinatorAgent`
    });

    return plan;
  } catch (error) {
    console.error('[CoordinatorAgent] Error:', error);

    await octokit.issues.createComment({
      owner: OWNER,
      repo: REPO,
      issue_number: issueNumber,
      body: `## ❌ CoordinatorAgent - エラー

エラーが発生しました:
\`\`\`
${error.message}
\`\`\`

🌸 Miyabi - CoordinatorAgent`
    });

    throw error;
  }
}
