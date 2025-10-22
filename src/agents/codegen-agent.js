import Anthropic from '@anthropic-ai/sdk';
import { Octokit } from '@octokit/rest';
import fs from 'fs/promises';
import path from 'path';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const OWNER = process.env.GITHUB_REPOSITORY?.split('/')[0] || 'zatsugaku';
const REPO = process.env.GITHUB_REPOSITORY?.split('/')[1] || 'office-timecard-system';

/**
 * CodeGenAgent - AI駆動コード生成
 *
 * 役割:
 * 1. CoordinatorAgentのプランに基づいてコード生成
 * 2. 既存ファイルの読み込み
 * 3. 新規ファイル作成・既存ファイル更新
 * 4. ブランチ作成・コミット・プッシュ
 */
export async function codegenAgent(issueNumber, issueTitle, issueBody, plan) {
  console.log(`[CodeGenAgent] Generating code for Issue #${issueNumber}`);

  const branchName = `feature/issue-${issueNumber}`;

  try {
    // Issueにコメント（開始通知）
    await octokit.issues.createComment({
      owner: OWNER,
      repo: REPO,
      issue_number: issueNumber,
      body: `## 🚀 CodeGenAgent - コード生成開始

ブランチ: \`${branchName}\`

実行中...

🌸 Miyabi - CodeGenAgent`
    });

    // ステップごとにコード生成
    const generatedFiles = [];

    for (const step of plan.steps) {
      if (step.agent !== 'codegen') continue;

      console.log(`[CodeGenAgent] Step ${step.id}: ${step.description}`);

      // 対象ファイルの読み込み
      const fileContents = await Promise.all(
        step.files.map(async (filePath) => {
          try {
            const content = await fs.readFile(filePath, 'utf-8');
            return { path: filePath, content, exists: true };
          } catch {
            return { path: filePath, content: '', exists: false };
          }
        })
      );

      // Claude APIでコード生成
      const codegenPrompt = `あなたはCodeGenAgentです。以下の指示に従って、**高品質なコード**を生成してください。

## Issue情報
- Issue番号: #${issueNumber}
- タイトル: ${issueTitle}
- 内容:
${issueBody}

## 実行ステップ
${step.description}

## 対象ファイル
${fileContents.map(f => `
### ${f.path} ${f.exists ? '(既存)' : '(新規)'}
\`\`\`
${f.content}
\`\`\`
`).join('\n')}

## コード品質基準（80点以上必須）

### 必須要件
1. **CSS変数の使用**: カラー、サイズなどはCSS変数で定義（例: --primary-color: #667eea;）
2. **モジュール化**: 関連するスタイルをセクションごとに明確に分離
3. **アクセシビリティ**: focus状態、十分なコントラスト比、キーボードナビゲーション対応
4. **レスポンシブ**: 768px（mobile）、1024px（tablet）、1280px（desktop）のブレークポイント
5. **パフォーマンス**: will-changeやtransform: translateZ(0)でGPUアクセラレーション
6. **コメント**: 日本語で詳細なセクションコメント
7. **重複排除**: 同じコードを2回出力しない

### 出力形式
各ファイルについて、以下の形式で**1回だけ**出力:

### ${step.files[0]}
\`\`\`css
/* 完全なファイル内容 */
\`\`\`

**重要**:
- 各ファイルの **完全な内容** を出力（差分ではなく）
- **同じファイルを2回出力しない**
- 上記の品質基準を必ず満たすこと`;

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8192,
        messages: [{
          role: 'user',
          content: codegenPrompt
        }]
      });

      const generatedCode = response.content[0].text;
      console.log('[CodeGenAgent] Generated code:', generatedCode.substring(0, 500));
      console.log('[CodeGenAgent] Current working directory:', process.cwd());

      // ファイルパスとコードを抽出
      const fileBlocks = Array.from(generatedCode.matchAll(/### (.+?)\n```(?:\w+)?\n([\s\S]*?)```/g));
      console.log(`[CodeGenAgent] Regex matches found: ${fileBlocks.length}`);

      for (const match of fileBlocks) {
        const filePath = match[1].trim();
        const fileContent = match[2];

        console.log(`\n[CodeGenAgent] Processing file: ${filePath}`);
        console.log(`[CodeGenAgent] Content length: ${fileContent.length} characters`);
        console.log(`[CodeGenAgent] Content preview: ${fileContent.substring(0, 100)}`);

        // ディレクトリ作成
        const dirPath = path.dirname(filePath);
        console.log(`[CodeGenAgent] Creating directory: ${dirPath}`);
        await fs.mkdir(dirPath, { recursive: true });

        // ファイル書き込み
        console.log(`[CodeGenAgent] Writing to: ${path.resolve(filePath)}`);
        await fs.writeFile(filePath, fileContent, 'utf-8');

        // 書き込み確認
        try {
          await fs.access(filePath);
          const stats = await fs.stat(filePath);
          console.log(`[CodeGenAgent] ✅ File written successfully: ${stats.size} bytes`);
        } catch (err) {
          console.error(`[CodeGenAgent] ❌ File verification failed: ${err.message}`);
        }

        generatedFiles.push(filePath);
        console.log(`[CodeGenAgent] Added to generatedFiles array: ${filePath}`);
      }

      console.log(`\n[CodeGenAgent] Total files processed: ${generatedFiles.length}`);
    }

    // Issueにコメント（完了通知）
    await octokit.issues.createComment({
      owner: OWNER,
      repo: REPO,
      issue_number: issueNumber,
      body: `## ✅ CodeGenAgent - コード生成完了

### 生成・更新されたファイル
${generatedFiles.map(f => `- \`${f}\``).join('\n')}

次のステップ: ReviewAgentを実行します...

🌸 Miyabi - CodeGenAgent`
    });

    return { branchName, generatedFiles };
  } catch (error) {
    console.error('[CodeGenAgent] Error:', error);

    await octokit.issues.createComment({
      owner: OWNER,
      repo: REPO,
      issue_number: issueNumber,
      body: `## ❌ CodeGenAgent - エラー

エラーが発生しました:
\`\`\`
${error.message}
\`\`\`

🌸 Miyabi - CodeGenAgent`
    });

    throw error;
  }
}
