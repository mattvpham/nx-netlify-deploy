import type { ExecutorContext } from '@nrwl/devkit';
import { spawn } from 'child_process';
import { copyFileSync, writeFileSync } from 'fs';

const NETLIFY_PROGRAM = 'netlify';
async function spawnNetlify(
  netlifySiteIdEnvVarName: string,
  configurationName: string,
  alias: string
) {
  // Load the NETLIFY_SITE_ID
  const netlifySiteId = process.env[netlifySiteIdEnvVarName];
  if (!netlifySiteId) {
    throw new Error(
      `Did not find netlifySiteId at env.${netlifySiteIdEnvVarName}!`
    );
  }

  let netlifyOptions = [];
  switch (configurationName) {
    case 'development':
    case 'staging':
      netlifyOptions = [
        'deploy',
        '--build',
        `--alias=${alias}`,
        `--message=${alias}`,
        `--site=${netlifySiteId}`,
      ];
      break;
    case 'production':
      netlifyOptions = [
        'deploy',
        '--build',
        '--prod',
        `--site=${netlifySiteId}`,
      ];
      break;
    default:
      throw new Error(`Unknown configuration! ${configurationName}`);
  }

  const child = spawn('npx', [NETLIFY_PROGRAM, ...netlifyOptions]);

  let output = '';
  child.stdout.on('data', (outChunk) => {
    const outChunkStr: string = outChunk.toString();
    process.stdout.write(outChunkStr);
    output += outChunkStr;
  });

  child.stderr.on('data', (errChunk) => {
    const errChunkStr = errChunk.toString();
    process.stderr.write(errChunkStr);
  });

  const exitCode = await new Promise((resolve, reject) => {
    child.on('close', resolve);
  });

  // Look for deployed site url
  let deployedTo = '';
  const lines = output.split('\n');
  for (const line of lines) {
    if (line.includes('Website URL:') || line.includes('Website Draft URL:')) {
      // The following regex comes from
      // "strip ANSI color codes": https://stackoverflow.com/a/29497680
      deployedTo = line.replace(
        /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
        ''
      );
    }
  }

  return { exitCode, deployedTo };
}

export interface DeployNetlifyExecutorOptions {
  alias: string;
  configurationName: string;
  netlifySiteIdEnvVarName: string;
  projectDirectory: string;
  siteTemplate: string;
}

export default async function deployNetlifyExecutor(
  options: DeployNetlifyExecutorOptions,
  context: ExecutorContext
): Promise<{ success: boolean }> {
  if (!options.projectDirectory) {
    throw new Error('Missing option projectDirectory!');
  }

  if (!process.env.NETLIFY_AUTH_TOKEN) {
    throw new Error('Missing environment variable NETLIFY_AUTH_TOKEN!');
  }

  console.info('Copying Netlify.toml...');
  copyFileSync(`${options.projectDirectory}/netlify.toml`, './netlify.toml');

  console.info(`Executing "netlify"...`);
  const { exitCode, deployedTo } = await spawnNetlify(
    options.netlifySiteIdEnvVarName,
    options.configurationName,
    options.alias
  );
  if (exitCode !== 0) {
    return { success: false };
  }

  console.info('Writing to deploy.txt...');
  console.info(deployedTo);

  writeFileSync('./deploy.txt', deployedTo, { encoding: 'utf-8', flag: 'a' });

  return { success: true };
}
