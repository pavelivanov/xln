<!--
  CommandPalette.svelte — ⌘K / Ctrl+K quick command interface

  Supports:
  - pay 100 usdc to @name     → instant payment
  - swap 0.5 weth for usdc    → navigate to swap with prefill
  - open H2                   → open account with hub
  - send 50 usdc to 0x...     → direct payment by address
  - balance / bal              → show balances
  - settings                   → open settings tab

  Case insensitive. Fuzzy entity name matching.
-->
<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { fly, fade } from 'svelte/transition';
  import {
    emptyCommandPaletteView,
    type CommandPaletteView,
  } from '../../../../packages/ui/src/workspace/command-palette-view';

  import { buildCommandPaletteSuggestions } from '../../../../packages/ui/src/workspace/command-palette-suggestions';

  export let isOpen = false;
  export let commandPaletteView: CommandPaletteView = emptyCommandPaletteView();

  const dispatch = createEventDispatcher<{
    close: void;
    command: { type: string; args: Record<string, unknown> };
  }>();

  let inputValue = '';
  let inputEl: HTMLInputElement;
  let selectedIndex = 0;

  type Suggestion = {
    id: string;
    icon: string;
    label: string;
    sublabel: string;
    action: () => void;
  };

  $: suggestions = buildSuggestions(inputValue, commandPaletteView);

  function buildSuggestions(query: string, view: CommandPaletteView): Suggestion[] {
    return buildCommandPaletteSuggestions(query, view).map(suggestion => ({
      ...suggestion,
      action: () => {
        if (suggestion.action.type === 'input') inputValue = suggestion.action.value;
        else if (suggestion.action.type === 'command') dispatch('command', suggestion.action.command);
      },
    }));
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      close();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, suggestions.length - 1);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const selected = suggestions[selectedIndex];
      if (selected) {
        selected.action();
        if (selected.id !== 'pay' && selected.id !== 'swap') close();
      }
      return;
    }
  }

  function close() {
    isOpen = false;
    inputValue = '';
    selectedIndex = 0;
    dispatch('close');
  }

  function handleGlobalKeydown(event: KeyboardEvent) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
      // Don't intercept when user is typing in an input/textarea/contenteditable
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase() || '';
      if (!isOpen && (tagName === 'input' || tagName === 'textarea' || target?.isContentEditable)) {
        return; // Let native Cmd+K work in text fields
      }
      event.preventDefault();
      if (isOpen) {
        close();
      } else {
        isOpen = true;
        requestAnimationFrame(() => inputEl?.focus());
      }
    }
  }

  $: if (inputValue !== undefined) selectedIndex = 0;

  onMount(() => {
    window.addEventListener('keydown', handleGlobalKeydown);
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleGlobalKeydown);
  });

  $: if (isOpen) {
    requestAnimationFrame(() => inputEl?.focus());
  }
</script>

{#if isOpen}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <div class="palette-backdrop" transition:fade={{ duration: 150 }} on:click={close} role="presentation">
    <div class="palette" transition:fly={{ y: -20, duration: 200 }} on:click|stopPropagation role="dialog" aria-label="Command palette" tabindex="-1">
      <div class="palette-input-wrap">
        <span class="palette-icon">⌘</span>
        <input
          bind:this={inputEl}
          bind:value={inputValue}
          class="palette-input"
          type="text"
          placeholder="Type a command... pay, swap, open, balance"
          spellcheck="false"
          autocomplete="off"
          on:keydown={handleKeydown}
          data-testid="command-palette-input"
        />
        <kbd class="palette-kbd">ESC</kbd>
      </div>
      {#if suggestions.length > 0}
        <ul class="palette-results">
          {#each suggestions as suggestion, i (suggestion.id)}
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <li
              class="palette-result"
              class:selected={i === selectedIndex}
              on:click={() => { suggestion.action(); if (suggestion.id !== 'pay' && suggestion.id !== 'swap') close(); }}
              on:mouseenter={() => selectedIndex = i}
              role="option"
              aria-selected={i === selectedIndex}
            >
              <span class="result-icon">{suggestion.icon}</span>
              <div class="result-text">
                <span class="result-label">{suggestion.label}</span>
                <span class="result-sublabel">{suggestion.sublabel}</span>
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </div>
{/if}

<style>
  .palette-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    z-index: 9999;
    display: flex;
    justify-content: center;
    padding-top: min(20vh, 120px);
  }

  .palette {
    width: min(560px, 90vw);
    max-height: min(420px, 60vh);
    background: #1a1a1e;
    border: 1px solid #2f2f35;
    border-radius: 14px;
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.04);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .palette-input-wrap {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 16px;
    border-bottom: 1px solid #27272a;
  }

  .palette-icon {
    color: #52525b;
    font-size: 16px;
    flex-shrink: 0;
  }

  .palette-input {
    flex: 1;
    background: none;
    border: none;
    outline: none;
    color: #f3f4f6;
    font-size: 15px;
    font-family: inherit;
    caret-color: #fbbf24;
  }

  .palette-input::placeholder {
    color: #52525b;
  }

  .palette-kbd {
    font-size: 10px;
    color: #52525b;
    background: #27272a;
    padding: 2px 6px;
    border-radius: 4px;
    border: 1px solid #3f3f46;
    font-family: 'JetBrains Mono', monospace;
    flex-shrink: 0;
  }

  .palette-results {
    list-style: none;
    margin: 0;
    padding: 6px;
    overflow-y: auto;
  }

  .palette-result {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.1s ease;
  }

  .palette-result.selected {
    background: rgba(251, 191, 36, 0.08);
  }

  .palette-result:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .result-icon {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 7px;
    background: #27272a;
    color: #a1a1aa;
    font-size: 14px;
    flex-shrink: 0;
  }

  .palette-result.selected .result-icon {
    background: rgba(251, 191, 36, 0.15);
    color: #fbbf24;
  }

  .result-text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .result-label {
    color: #e5e7eb;
    font-size: 13px;
    font-weight: 500;
  }

  .result-sublabel {
    color: #52525b;
    font-size: 11px;
    margin-top: 1px;
  }
</style>
