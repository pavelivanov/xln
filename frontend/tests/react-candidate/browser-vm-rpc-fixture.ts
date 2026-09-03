import { getBytes, hexlify, type TransactionRequest } from 'ethers';

import type { JAdapter } from '../../../core/jurisdiction/adapter/types';
export type BrowserVmRpcFixture = Readonly<{
  chainAdapter: JAdapter;
  rpcUrl: string;
  close: () => Promise<void>;
}>;

const quantity = (value: number | bigint | string): string => `0x${BigInt(value).toString(16)}`;

const combineBlooms = (blooms: readonly string[]): string => {
  const combined = new Uint8Array(256);
  for (const bloom of blooms) {
    const bytes = getBytes(bloom);
    if (bytes.length !== combined.length) throw new Error('WALLET_RECOVERY_FIXTURE_RECEIPT_BLOOM_INVALID');
    bytes.forEach((byte, index) => { combined[index] = (combined[index] ?? 0) | byte; });
  }
  return hexlify(combined);
};

export const createBrowserVmRpcFixture = async (rpcPort: number): Promise<BrowserVmRpcFixture> => {
  if (!Number.isSafeInteger(rpcPort) || rpcPort < 1 || rpcPort > 65_535) {
    throw new Error('WALLET_RECOVERY_FIXTURE_PORT_INVALID');
  }
  const { createJAdapter } = await import('../../../core/jurisdiction/adapter/kernel/factory');
  const chainId = 31_337;
  const chainAdapter = await createJAdapter({ mode: 'browservm', chainId });
  if (!chainAdapter.getBrowserVM()) throw new Error('WALLET_RECOVERY_FIXTURE_BROWSERVM_REQUIRED');
  const browserVmState = await chainAdapter.dumpState();
  if (typeof browserVmState === 'string') throw new Error('WALLET_RECOVERY_FIXTURE_BROWSERVM_STATE_INVALID');
  const receipts = new Map(browserVmState.chain.txReceipts);
  const receiptRoots = new Map(browserVmState.chain.blockReceiptRoots);
  const blockHashes = new Map(browserVmState.chain.blockHashes);
  const blockHashAt = (blockNumber: number): string => {
    const hash = blockHashes.get(blockNumber);
    if (!hash) throw new Error(`WALLET_RECOVERY_FIXTURE_BLOCK_HASH_MISSING:${blockNumber}`);
    return hash;
  };
  const receiptsAt = (blockNumber: number) => [...receipts.values()]
    .filter((receipt) => receipt.blockNumber === blockNumber)
    .sort((left, right) => left.transactionIndex - right.transactionIndex);
  const blockHeight = (value: unknown): number => value === 'latest'
    ? browserVmState.chain.blockHeight
    : Number(BigInt(String(value || '0x0')));
  const rawReceipt = (hash: string) => {
    const receipt = receipts.get(hash);
    if (!receipt) return null;
    return {
      ...receipt,
      blockNumber: quantity(receipt.blockNumber),
      cumulativeGasUsed: quantity(receipt.cumulativeGasUsed),
      status: quantity(receipt.status),
      transactionIndex: quantity(receipt.transactionIndex),
      type: quantity(receipt.type),
      logs: receipt.logs.map((log) => ({
        ...log,
        blockHash: receipt.blockHash,
        blockNumber: quantity(log.blockNumber),
        transactionHash: receipt.transactionHash,
        transactionIndex: quantity(receipt.transactionIndex),
        logIndex: quantity(log.logIndex),
        removed: false,
      })),
    };
  };
  const executeRpc = async (method: string, params: unknown[]): Promise<unknown> => {
    if (method === 'eth_chainId') return quantity(chainId);
    if (method === 'eth_blockNumber') return quantity(browserVmState.chain.blockHeight);
    if (method === 'eth_getCode') {
      return chainAdapter.provider.getCode(String(params[0] || ''), String(params[1] || 'latest'));
    }
    if (method === 'eth_call') {
      if (!params[0] || typeof params[0] !== 'object' || Array.isArray(params[0])) {
        throw new Error('WALLET_RECOVERY_FIXTURE_RPC_CALL_INVALID');
      }
      return chainAdapter.provider.call(params[0] as TransactionRequest);
    }
    if (method === 'eth_getBlockByNumber') {
      const blockNumber = blockHeight(params[0]);
      const blockReceipts = receiptsAt(blockNumber);
      const receiptsRoot = receiptRoots.get(blockNumber);
      if (!receiptsRoot) throw new Error(`WALLET_RECOVERY_FIXTURE_RECEIPT_ROOT_MISSING:${blockNumber}`);
      const zeroHash = `0x${'0'.repeat(64)}`;
      return {
        hash: blockHashAt(blockNumber),
        parentHash: blockNumber > 1 ? blockHashAt(blockNumber - 1) : zeroHash,
        number: quantity(blockNumber),
        receiptsRoot,
        logsBloom: combineBlooms(blockReceipts.map((receipt) => receipt.logsBloom)),
        transactions: blockReceipts.map((receipt) => receipt.transactionHash),
      };
    }
    if (method === 'eth_getTransactionReceipt') return rawReceipt(String(params[0] || ''));
    if (method === 'eth_getLogs') {
      const filter = params[0];
      if (!filter || typeof filter !== 'object' || Array.isArray(filter)) {
        throw new Error('WALLET_RECOVERY_FIXTURE_RPC_LOG_FILTER_INVALID');
      }
      const record = filter as Record<string, unknown>;
      const fromBlock = blockHeight(record['fromBlock'] ?? '0x0');
      const toBlock = blockHeight(record['toBlock'] ?? 'latest');
      const rawAddresses = record['address'];
      const addresses = rawAddresses === undefined
        ? null
        : new Set((Array.isArray(rawAddresses) ? rawAddresses : [rawAddresses])
          .map((address) => String(address).toLowerCase()));
      return [...receipts.values()]
        .filter((receipt) => receipt.blockNumber >= fromBlock && receipt.blockNumber <= toBlock)
        .flatMap((receipt) => receipt.logs
          .filter((log) => !addresses || addresses.has(log.address.toLowerCase()))
          .map((log) => ({
            ...log,
            blockHash: receipt.blockHash,
            blockNumber: quantity(log.blockNumber),
            transactionHash: receipt.transactionHash,
            transactionIndex: quantity(receipt.transactionIndex),
            logIndex: quantity(log.logIndex),
            removed: false,
          })));
    }
    throw new Error(`WALLET_RECOVERY_FIXTURE_RPC_METHOD_UNSUPPORTED:${method}`);
  };
  const rpcHeaders = {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'POST,OPTIONS',
    'access-control-allow-headers': 'content-type',
    'content-type': 'application/json',
  };
  const handleRpcEnvelope = async (body: unknown): Promise<Record<string, unknown>> => {
    const request = body && typeof body === 'object' && !Array.isArray(body)
      ? body as Record<string, unknown>
      : null;
    const id = request?.['id'] ?? null;
    try {
      if (!request) throw new Error('WALLET_RECOVERY_FIXTURE_RPC_REQUEST_INVALID');
      const method = String(request['method'] || '').trim();
      if (!method) throw new Error('WALLET_RECOVERY_FIXTURE_RPC_METHOD_REQUIRED');
      const params = request['params'];
      return { jsonrpc: '2.0', id, result: await executeRpc(method, Array.isArray(params) ? params : []) };
    } catch (error: unknown) {
      return {
        jsonrpc: '2.0', id,
        error: { code: -32_603, message: error instanceof Error ? error.message : String(error) },
      };
    }
  };
  const rpcServer = Bun.serve({
    hostname: '127.0.0.1',
    port: rpcPort,
    async fetch(request) {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: rpcHeaders });
      try {
        const body = await request.json() as unknown;
        const response = Array.isArray(body)
          ? await Promise.all(body.map(handleRpcEnvelope))
          : await handleRpcEnvelope(body);
        return Response.json(response, { headers: rpcHeaders });
      } catch (error: unknown) {
        return Response.json({
          jsonrpc: '2.0', id: null,
          error: { code: -32_603, message: error instanceof Error ? error.message : String(error) },
        }, { status: 500, headers: rpcHeaders });
      }
    },
  });
  return {
    chainAdapter,
    rpcUrl: `http://127.0.0.1:${rpcServer.port}`,
    close: async () => {
      rpcServer.stop(true);
      await chainAdapter.close();
    },
  };
};
