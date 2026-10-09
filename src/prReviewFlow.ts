import 'dotenv/config';
import * as readline from 'readline';
import { mastra } from './mastra/index.ts';
import { postPRReviewTool } from './mastra/tools/postPRReviewTool.ts';
import { prReviewerAgent } from './mastra/agents/pr/prReviewerAgent.ts';

export interface PRTarget {
  owner: string;
  repo: string;
  pullNumber: number;
}

function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans.trim());
    })
  );
}

function getShortPreview(fullReport: string): string {
  const lines = fullReport.split('\n');
  const previewLines: string[] = [];
  let lineCount = 0;

  for (const line of lines) {
    previewLines.push(line);
    lineCount++;
    if (lineCount >= 25) {
      previewLines.push('\n... [Full detailed report with line-by-line diff suggestions ready to post] ...');
      break;
    }
  }

  return previewLines.join('\n');
}

export async function reviewWithApproval(prTarget: PRTarget): Promise<void> {
  console.log('====================================================');
  console.log('🐙 Automated GitHub PR Reviewer (Human Approval Loop)');
  console.log('====================================================\n');

  const workflow = mastra.getWorkflow('prReviewWorkflow');

  console.log(`📌 Target PR: https://github.com/${prTarget.owner}/${prTarget.repo}/pull/${prTarget.pullNumber}`);

  try {
    const run = await workflow.createRun();
    const result = await run.start({ inputData: prTarget });

    if (result.status !== 'success' || !result.result) {
      console.error('❌ Workflow execution failed:', result);
      return;
    }

    let currentReport = result.result.prReviewReport;
    let approved = false;

    while (!approved) {
      console.log('\n====================================================');
      console.log('📄 PROPOSED GITHUB PR REVIEW PREVIEW');
      console.log('====================================================\n');
      console.log(getShortPreview(currentReport));
      console.log('\n====================================================');

      const answer = await askQuestion('\n❓ Approve and post to GitHub? Options: (yes / no / view full comment): ');
      const cleanAnswer = answer.toLowerCase().trim();

      if (cleanAnswer === 'view' || cleanAnswer === 'v' || cleanAnswer === 'full') {
        console.log('\n====================================================');
        console.log('📜 FULL PR REVIEW COMMENT (EXACT MARKDOWN TO BE POSTED)');
        console.log('====================================================\n');
        console.log(currentReport);
        console.log('\n====================================================');
        
        const confirmAnswer = await askQuestion('\n❓ Do you approve posting this full comment to GitHub now? (yes / no): ');
        if (confirmAnswer.toLowerCase() === 'yes' || confirmAnswer.toLowerCase() === 'y') {
          approved = true;
        } else {
          const feedback = await askQuestion('📝 What feedback or changes should be made to the PR review comment?\n> ');
          console.log('\n⏳ Regenerating revised PR Review comment based on your feedback...');
          const revisionPrompt = `The human reviewer rejected the previous PR review comment with the following feedback:
          "${feedback}"

          ### Previous PR Review Comment:
          ${currentReport}

          Please generate a revised, updated PR Review Report addressing all user feedback.`;

          const revisionResponse = await prReviewerAgent.generateLegacy(revisionPrompt, { maxSteps: 3 });
          currentReport = revisionResponse.text;
        }
      } else if (cleanAnswer === 'yes' || cleanAnswer === 'y') {
        approved = true;
      } else {
        console.log('\n✋ Review rejected by user.');
        const feedback = await askQuestion('📝 What feedback or changes should be made to the PR review comment?\n> ');

        console.log('\n⏳ Regenerating revised PR Review comment based on your feedback...');

        const revisionPrompt = `The human reviewer rejected the previous PR review comment with the following feedback:
        "${feedback}"

        ### Previous PR Review Comment:
        ${currentReport}

        Please generate a revised, updated PR Review Report addressing all user feedback.`;

        const revisionResponse = await prReviewerAgent.generateLegacy(revisionPrompt, { maxSteps: 3 });
        currentReport = revisionResponse.text;
      }

      if (approved) {
        console.log('\n🚀 Approval granted! Publishing review comment to GitHub...');

        const postResult = await postPRReviewTool.execute({
          owner: prTarget.owner,
          repo: prTarget.repo,
          pullNumber: prTarget.pullNumber,
          reviewReport: currentReport,
          event: 'COMMENT',
        });

        console.log(`\n🎉 ${postResult.message}`);
        if (postResult.htmlUrl) {
          console.log(`🔗 Review Link: ${postResult.htmlUrl}`);
        }
      }
    }
  } catch (error) {
    console.error('❌ Error during PR Review loop:', error);
  }
}
