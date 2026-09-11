<script lang="ts">
  import EntityAuditPanel from '$lib/components/Entity/activity/EntityAuditPanel.svelte';
  import { runtimeView } from '../../../../bridges/runtime/runtime-view-store';

  $: entityId = String($runtimeView.activeEntityId || $runtimeView.frame?.activeEntityId || '').trim().toLowerCase();
</script>

<EntityAuditPanel {entityId} />
