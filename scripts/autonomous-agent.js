#!/usr/bin/env node

import { coordinatorAgent } from '../src/agents/coordinator-agent.js';
import { codegenAgent } from '../src/agents/codegen-agent.js';
import { reviewAgent } from '../src/agents/review-agent.js';
import { prAgent } from '../src/agents/pr-agent.js';

/**
 * Miyabi Autonomous Agent - メインオーケストレーター
 *
 * GitHub Actionsから呼び出され、以下の流れで自動実行:
 * 1. CoordinatorAgent: Issue分析・実行プラン作成
 * 2. CodeGenAgent: コード生成
 * 3. ReviewAgent: 品質チェック（80点以上で合格）
 * 4. PRAgent: Pull Request作成
 */

async function main() {
  const issueNumber = parseInt(process.env.ISSUE_NUMBER);
  const issueTitle = process.env.ISSUE_TITLE;
  const issueBody = process.env.ISSUE_BODY;

  console.log('='.repeat(80));
  console.log('🌸 Miyabi Autonomous Agent - Starting');
  console.log('='.repeat(80));
  console.log(`Issue #${issueNumber}: ${issueTitle}`);
  console.log('='.repeat(80));

  try {
    // Step 1: CoordinatorAgent - タスク分析
    console.log('\n[1/4] CoordinatorAgent - タスク分析中...');
    const plan = await coordinatorAgent(issueNumber, issueTitle, issueBody);
    console.log(`✅ 実行プラン作成完了 (推定トークン: ${plan.estimatedTokens})`);

    // Step 2: CodeGenAgent - コード生成
    console.log('\n[2/4] CodeGenAgent - コード生成中...');
    const { branchName, generatedFiles } = await codegenAgent(
      issueNumber,
      issueTitle,
      issueBody,
      plan
    );
    console.log(`✅ コード生成完了 (${generatedFiles.length}ファイル)`);

    // Step 3: ReviewAgent - 品質チェック
    console.log('\n[3/4] ReviewAgent - 品質チェック中...');
    const { passed, review } = await reviewAgent(issueNumber, generatedFiles);
    console.log(`${passed ? '✅' : '❌'} 品質スコア: ${review.totalScore}/100`);

    if (!passed) {
      console.error('❌ 品質スコアが80点未満のため、処理を中断します。');
      console.error('手動で修正するか、CodeGenAgentを再実行してください。');
      process.exit(1);
    }

    // Step 4: PRAgent - Pull Requestメタデータ生成
    console.log('\n[4/4] PRAgent - Pull Requestメタデータ生成中...');
    const prMetadata = await prAgent(issueNumber, issueTitle, branchName, generatedFiles, review);
    console.log(`✅ PRメタデータ生成完了`);
    console.log(`タイトル: ${prMetadata.title}`);
    console.log(`ファイル数: ${prMetadata.generatedFiles.length}`);

    console.log('\n' + '='.repeat(80));
    console.log('🎉 Miyabi Autonomous Agent - 完了');
    console.log('='.repeat(80));
    console.log('GitHub Actions workflowが以下を実行します：');
    console.log('1. ブランチ作成');
    console.log('2. ファイルコミット');
    console.log('3. Draft PR作成');
    console.log('='.repeat(80));

    process.exit(0);
  } catch (error) {
    console.error('\n' + '='.repeat(80));
    console.error('❌ Miyabi Autonomous Agent - エラー');
    console.error('='.repeat(80));
    console.error(error);
    console.error('='.repeat(80));

    process.exit(1);
  }
}

main();
