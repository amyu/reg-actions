import { basename } from 'path';

import { Event } from './event';
import { Run } from './run';
import { CompareOutput } from './compare';

export type CreateCommentWithTargetInput = {
  event: Event;
  runId: number;
  sha: string;
  regBranch: string;
  artifactName: string;
  targetRun: Run;
  result: CompareOutput;
  date: string;
  customReportPage: string | null;
};

export type CreateCommentWithoutTargetInput = {
  event: Event;
  runId: number;
  result: CompareOutput;
  artifactName: string;
  customReportPage: string | null;
};

const isSuccess = (result: CompareOutput) => {
  return result.failedItems.length === 0 && result.newItems.length === 0 && result.deletedItems.length === 0;
};

const badge = (result: CompareOutput) => {
  if (result.failedItems.length) {
    return '![change detected](https://img.shields.io/badge/%E2%9C%94%20reg-change%20detected-orange)';
  }
  if (result.newItems.length) {
    return '![new items](https://img.shields.io/badge/%E2%9C%94%20reg-new%20items-green)';
  }
  return '![success](https://img.shields.io/badge/%E2%9C%94%20reg-passed-green)';
};

const createBaseUrl = ({
  owner,
  repoName,
  branch,
  runId,
  artifactName,
  date,
}: {
  owner: string;
  repoName: string;
  branch: string;
  runId: number;
  artifactName: string;
  date: string;
}): string => {
  return `https://github.com/${owner}/${repoName}/blob/${branch}/${date}_${runId}_${artifactName}/`;
};

const differences = ({ result, baseUrl }: { result: CompareOutput; baseUrl: string }): string => {
  if (result.failedItems.length === 0) return '';
  const comment = `   
     
### Differences
  
${result.failedItems
  .map(item => {
    const base = basename(item);
    const filename = encodeURIComponent(base);
    const actual = baseUrl + 'actual/' + filename + '?raw=true';
    const expected = baseUrl + 'expected/' + filename + '?raw=true';
    const diff = baseUrl + 'diff/' + filename + '?raw=true';

    return `### \`${base}\`
   
| actual|![Actual](${actual}) |
|--|--|
|expected|![Expected](${expected})|
|difference|![Difference](${diff})|`;
  })
  .join('\n')}
  `;

  return comment;
};

const newItems = ({ result, baseUrl }: { result: CompareOutput; baseUrl: string }): string => {
  if (result.newItems.length === 0) return '';
  const comment = `   
     
### New Items
  
${result.newItems
  .map(item => {
    const base = basename(item);
    const filename = encodeURIComponent(base);
    const img = baseUrl + 'actual/' + filename + '?raw=true';
    return `### \`${base}\`
       
|  |
|--|
|![NewItem](${img})|
       `;
  })
  .join('\n')}
  `;

  return comment;
};

const deletedItems = ({ result, baseUrl }: { result: CompareOutput; baseUrl: string }): string => {
  if (result.deletedItems.length === 0) return '';
  const comment = `   
   
### Deleted Items
  
${result.deletedItems
  .map(item => {
    const base = basename(item);
    const filename = encodeURIComponent(base);
    const img = baseUrl + 'expected/' + filename + '?raw=true';
    return `### \`${base}\`
       
|  |
|--|
|![DeleteItem](${img})|
       `;
  })
  .join('\n')}
  `;

  return comment;
};

export const createCommentWithTarget = ({
  event,
  runId,
  regBranch,
  artifactName,
  sha: currentHash,
  targetRun,
  result,
  date,
  customReportPage,
}: CreateCommentWithTargetInput): string => {
  const [owner, repoName] = event.repository.full_name.split('/');
  const targetHash = targetRun.head_sha;
  const currentHashShort = currentHash.slice(0, 7);
  const targetHashShort = targetHash.slice(0, 7);
  const baseUrl = createBaseUrl({ owner, repoName, branch: regBranch, runId, artifactName, date });
  const report = customReportPage
    ? `   
Check out the report [here](${customReportPage}).`
    : '';
  const successOrFailMessage = isSuccess(result)
    ? `${badge(result)}

## ArtifactName: \`${artifactName}\`
  
✨✨ That's perfect, there is no visual difference! ✨✨
Check out the report [here](${report}).
    `
    : `${badge(result)}

## ArtifactName: \`${artifactName}\`

Check out the report [here](${report}).
    `;

  const body = `This report was generated by comparing [${currentHashShort}](https://github.com/${owner}/${repoName}/commit/${currentHash}) with [${targetHashShort}](https://github.com/${owner}/${repoName}/commit/${targetHash}).
If you would like to check difference, please check [here](https://github.com/${owner}/${repoName}/compare/${targetHashShort}..${currentHashShort}).
  
${successOrFailMessage}
  
| item    | count                         |
|:--------|:-----------------------------:|
| pass    | ${result.passedItems.length}  |
| change  | ${result.failedItems.length}  |
| new     | ${result.newItems.length}     |
| delete  | ${result.deletedItems.length} |

<details>
<summary>📝 Report</summary>
${differences({ result, baseUrl })}
${newItems({ result, baseUrl })}
${deletedItems({ result, baseUrl })}
</details>
`;

  return body;
};

export const createCommentWithoutTarget = ({
  result,
  artifactName,
  customReportPage,
}: CreateCommentWithoutTargetInput): string => {
  const report = customReportPage
    ? `   
  Check out the report [here](${customReportPage}).`
    : '';
  const body = `## ArtifactName: \`${artifactName}\`
  
Failed to find a target artifact.
All items will be treated as new items and will be used as expected data for the next time.

![target not found](https://img.shields.io/badge/%E2%9C%94%20reg-new%20items-blue)
${report}

| item    | count                         |
|:--------|:-----------------------------:|
| new     | ${result.newItems.length}     |
  `;

  return body;
};
