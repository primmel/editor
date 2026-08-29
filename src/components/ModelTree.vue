<script setup lang="ts">
import { computed } from 'vue';
import type { Standard } from '@primmel/primmel';
import { createConstruct, createElement, createInList, mintId } from '../lib/commands';
import { newAttributeDefinition, newBehavior, newCalculation, newCapability, newConditionSet, newConstraint, newDual, newInstrument, newQuantityRegister, newReferenceMaterial, newStateMachine, newSubject, newSymbol, newTable, newTerm, newTestPointSet, newTestSequence, newVerdict } from '../lib/factory';
import { useModelStore } from '../stores/model';
import { useUiStore } from '../stores/ui';
import type { SelectionType } from '../stores/ui';

const props = defineProps<{ model: Standard }>();
const ui = useUiStore();
const modelStore = useModelStore();

/** The package file map (TODO.editor wave 1) — when the unit of work
 *  is a package, the tree opens with its files (construct counts from
 *  the provenance load); imported packages' files follow, dimmed (they
 *  are context, never the unit of work). */
const pkg = computed(() => modelStore.pkg);

interface TreeGroup {
  label: string;
  type: SelectionType;
  /** Id prefix when the group offers in-tree creation. */
  createPrefix?: string;
  items: { id: string; detail?: string; children?: string[]; depth?: number }[];
}

const groups = computed<TreeGroup[]>(() => {
  void modelStore.version; // commands mutate the AST in place — re-derive
  const m = props.model;
  const childSet = new Set<string>();
  for (const p of m.processes) {
    for (const c of p.children ?? []) childSet.add(c);
  }
  const topProcesses = m.processes.filter(p => !p.parent || !childSet.has(p.id) && !p.parent);

  const processItems = topProcesses.map(p => ({
    id: p.id,
    detail: p.name,
    children: p.children ?? [],
    depth: 0,
  }));

  const result: TreeGroup[] = [
    { label: 'Roles', type: 'role', items: m.roles.map((r) => ({ id: r.id, detail: r.name })) },
    { label: 'Processes', type: 'process', items: processItems },
    { label: 'Approvals', type: 'approval', items: m.approvals.map((a) => ({ id: a.id, detail: a.name })) },
    { label: 'Provisions', type: 'provision', items: m.provisions.map((p) => ({ id: p.id, detail: p.modality })) },
    { label: 'Events', type: 'event', items: m.events.map((e) => ({ id: e.id, detail: e.eventType })) },
    { label: 'Gateways', type: 'gateway', items: m.gateways.map((g) => ({ id: g.id, detail: g.gatewayType })) },
    { label: 'Canvases', type: 'canvas', items: m.pages.map((p) => ({ id: p.id })) },
    { label: 'Data Classes', type: 'dataclass', createPrefix: 'DC', items: m.dataclasses.map((d) => ({ id: d.id })) },
    { label: 'Registries', type: 'registry', createPrefix: 'REG', items: m.regs.map((r) => ({ id: r.id })) },
    { label: 'Enums', type: 'enum', createPrefix: 'EN', items: m.enums.map((e) => ({ id: e.id, detail: `${e.values.length} values` })) },
    { label: 'Variables', type: 'measurement', items: m.variables.map((v) => ({ id: v.id })) },
    { label: 'Notes', type: 'reference', items: m.notes.map((n) => ({ id: n.id })) },
    // The v3 construct surfaces (TODO.editor wave 03): the kernel's
    // non-canvas collections — tree section, in-tree create, inspector.
    { label: 'Terms', type: 'term', createPrefix: 'Term', items: m.terms.map((t) => ({ id: t.id, detail: t.label })) },
    { label: 'Symbols', type: 'symbol', createPrefix: 'Sym', items: m.symbols.map((s) => ({ id: s.id, detail: s.name || s.type })) },
    { label: 'Constraints', type: 'constraint', createPrefix: 'Constraint', items: m.constraints.map((c) => ({ id: c.id, detail: c.name })) },
    { label: 'Calculations', type: 'calculation', createPrefix: 'Calc', items: m.calculations.map((c) => ({ id: c.id, detail: c.name || c.identifier })) },
    { label: 'Tables', type: 'table', createPrefix: 'Table', items: m.tables.map((t) => ({ id: t.id, detail: t.title || `${t.data.length} rows` })) },
    { label: 'State Machines', type: 'stateMachine', createPrefix: 'Machine', items: m.stateMachines.map((s) => ({ id: s.entityName, detail: s.kind })) },
    { label: 'Test Sequences', type: 'testSequence', createPrefix: 'Seq', items: m.testSequences.map((s) => ({ id: s.id, detail: `${s.steps.length} steps` })) },
    { label: 'Test Point Sets', type: 'testPointSet', createPrefix: 'TPS', items: m.testPointSets.map((t) => ({ id: t.id, detail: `${t.points.length} points` })) },
    { label: 'Subjects', type: 'subject', createPrefix: 'Subject', items: m.subjects.map((s) => ({ id: s.id, detail: s.extends ? `extends ${s.extends}` : undefined })) },
    { label: 'Attribute Definitions', type: 'attributeDefinition', createPrefix: 'Attr', items: m.attributeDefinitions.map((a) => ({ id: a.id, detail: a.name })) },
    { label: 'Instruments', type: 'instrument', createPrefix: 'MI', items: m.instruments.map((i) => ({ id: i.id, detail: i.extends ? `extends ${i.extends}` : undefined })) },
    { label: 'Behaviors', type: 'behavior', createPrefix: 'Behavior', items: m.behaviors.map((b) => ({ id: b.id, detail: b.kind })) },
    { label: 'Capabilities', type: 'capability', createPrefix: 'Capability', items: m.capabilities.map((c) => ({ id: c.id, detail: c.label })) },
    { label: 'Condition Sets', type: 'conditionSet', createPrefix: 'CondSet', items: m.conditionSets.map((c) => ({ id: c.id, detail: c.role })) },
    { label: 'Verdicts', type: 'verdict', createPrefix: 'Verdict', items: m.verdicts.map((v) => ({ id: v.id, detail: v.symbol ?? v.quantityKind })) },
    { label: 'Quantity Registers', type: 'quantityRegister', createPrefix: 'QR', items: m.quantityRegisters.map((q) => ({ id: q.id, detail: `${q.units.length} units` })) },
    { label: 'Duals', type: 'dual', createPrefix: 'Dual', items: m.duals.map((d) => ({ id: d.id, detail: d.attribute })) },
    { label: 'Reference Materials', type: 'referenceMaterial', createPrefix: 'RM', items: m.referenceMaterials.map((r) => ({ id: r.id, detail: r.name || r.kind })) },
    // The program constructs (TODO.editor/40): palette-created, listed
    // here — selecting one opens the plugin's inspector.
    { label: 'Requirement Classes', type: 'requirementClass', items: m.requirementClasses.map((c) => ({ id: c.id, detail: c.name })) },
    { label: 'Requirements', type: 'requirement', items: m.requirements.map((r) => ({ id: r.id, detail: r.name })) },
    { label: 'Conformance Tests', type: 'conformanceTest', items: m.conformanceTests.map((t) => ({ id: t.id, detail: t.name })) },
  ];
  return result.filter((g) => g.items.length > 0 || g.createPrefix);
});

/** In-tree creation (dataclass / registry / enum) — the element lands
 *  in the model and becomes the selection, ready for its inspector. */
function createIn(group: TreeGroup) {
  const m = props.model;
  const id = mintId(m, group.createPrefix!);
  switch (group.type) {
    case 'dataclass':
      modelStore.execute(createElement('dataclass', id));
      break;
    case 'registry':
      modelStore.execute(createInList((a: Standard) => a.regs, { id, title: '', data: null }, `create registry ${id}`));
      break;
    case 'enum':
      modelStore.execute(createInList((a: Standard) => a.enums, { id, values: [] }, `create enum ${id}`));
      break;
    case 'term':
      modelStore.execute(createConstruct((a: Standard) => a.terms, newTerm(id), `create term ${id}`));
      break;
    case 'constraint':
      modelStore.execute(createConstruct((a: Standard) => a.constraints, newConstraint(id), `create constraint ${id}`));
      break;
    case 'calculation':
      modelStore.execute(createConstruct((a: Standard) => a.calculations, newCalculation(id), `create calculation ${id}`));
      break;
    case 'table':
      modelStore.execute(createConstruct((a: Standard) => a.tables, newTable(id), `create table ${id}`));
      break;
    case 'stateMachine':
      modelStore.execute(createConstruct((a: Standard) => a.stateMachines, newStateMachine(id), `create state machine ${id}`));
      break;
    case 'testSequence':
      modelStore.execute(createConstruct((a: Standard) => a.testSequences, newTestSequence(id), `create test sequence ${id}`));
      break;
    case 'testPointSet':
      modelStore.execute(createConstruct((a: Standard) => a.testPointSets, newTestPointSet(id), `create test point set ${id}`));
      break;
    case 'subject':
      modelStore.execute(createConstruct((a: Standard) => a.subjects, newSubject(id), `create subject ${id}`));
      break;
    case 'behavior':
      modelStore.execute(createConstruct((a: Standard) => a.behaviors, newBehavior(id), `create behavior ${id}`));
      break;
    case 'capability':
      modelStore.execute(createConstruct((a: Standard) => a.capabilities, newCapability(id), `create capability ${id}`));
      break;
    case 'conditionSet':
      modelStore.execute(createConstruct((a: Standard) => a.conditionSets, newConditionSet(id), `create condition set ${id}`));
      break;
    case 'verdict':
      modelStore.execute(createConstruct((a: Standard) => a.verdicts, newVerdict(id), `create verdict ${id}`));
      break;
    case 'symbol':
      modelStore.execute(createConstruct((a: Standard) => a.symbols, newSymbol(id), `create symbol ${id}`));
      break;
    case 'attributeDefinition':
      modelStore.execute(createConstruct((a: Standard) => a.attributeDefinitions, newAttributeDefinition(id), `create attribute definition ${id}`));
      break;
    case 'quantityRegister':
      modelStore.execute(createConstruct((a: Standard) => a.quantityRegisters, newQuantityRegister(id), `create quantity register ${id}`));
      break;
    case 'dual':
      modelStore.execute(createConstruct((a: Standard) => a.duals, newDual(id), `create dual ${id}`));
      break;
    case 'referenceMaterial':
      modelStore.execute(createConstruct((a: Standard) => a.referenceMaterials, newReferenceMaterial(id), `create reference material ${id}`));
      break;
    case 'instrument':
      modelStore.execute(createConstruct((a: Standard) => a.instruments, newInstrument(id), `create instrument ${id}`));
      break;
    default:
      return;
  }
  ui.select(id, group.type);
}

function childItems(parentId: string, depth: number): { id: string; detail?: string; depth: number }[] {
  const parent = props.model.processes.find(p => p.id === parentId);
  if (!parent || !parent.children || parent.children.length === 0) return [];
  const items: { id: string; detail?: string; depth: number }[] = [];
  for (const childId of parent.children) {
    const child = props.model.processes.find(p => p.id === childId);
    if (child) {
      items.push({ id: child.id, detail: child.name, depth });
      items.push(...childItems(child.id, depth + 1));
    }
  }
  return items;
}

function selectItem(type: SelectionType, id: string) {
  ui.select(id, type);
  if (type === 'canvas') ui.setCanvas(id);
}
</script>

<template>
  <div class="model-tree">
    <template v-if="pkg">
      <div class="tree-group" data-testid="package-files">
        <div class="group-header">package {{ pkg.id }} — files ({{ pkg.files.length }})</div>
        <ul class="group-items">
          <li
            v-for="f in pkg.files"
            :key="f.path"
            class="pkg-file"
            :data-testid="`package-file-${f.path}`"
            :title="f.path"
          >
            <span class="item-id">{{ f.path }}</span>
            <span class="item-detail">{{ f.role === 'manifest' ? 'manifest' : `${f.constructs} constructs` }}</span>
          </li>
        </ul>
      </div>
      <div v-for="imp in pkg.imports" :key="imp.package" class="tree-group" :data-testid="`package-import-${imp.package}`">
        <div class="group-header">uses {{ imp.package }}</div>
        <ul class="group-items">
          <li v-for="f in imp.files" :key="imp.package + '/' + f.path" class="pkg-file import" :title="`${imp.package}/${f.path}`">
            <span class="item-id">{{ f.path }}</span>
            <span class="item-detail">{{ f.constructs }} constructs</span>
          </li>
        </ul>
      </div>
    </template>

    <div v-for="group in groups" :key="group.label" class="tree-group">
      <div class="group-header">
        {{ group.label }} ({{ group.items.length }})
        <button
          v-if="group.createPrefix && !modelStore.readOnly"
          type="button"
          class="group-add"
          :title="`new ${group.label.toLowerCase()}`"
          :data-testid="`tree-add-${group.type}`"
          @click.stop="createIn(group)"
        >+</button>
      </div>
      <ul class="group-items">
        <li
          v-for="item in group.items"
          :key="item.id"
          :class="{ active: ui.isSelected(item.id) }"
          :style="{ paddingLeft: (0.5 + (item.depth ?? 0) * 1) + 'rem' }"
          @click="selectItem(group.type, item.id)"
        >
          <span v-if="item.depth && item.depth > 0" class="tree-arrow">↳</span>
          <span class="item-id">{{ item.id }}</span>
          <span v-if="item.detail" class="item-detail">{{ item.detail }}</span>
        </li>
        <template v-if="group.type === 'process'">
          <template v-for="parent in group.items" :key="parent.id + '-children'">
            <li
              v-for="child in childItems(parent.id, 1)"
              :key="child.id"
              :class="{ active: ui.isSelected(child.id) }"
              :style="{ paddingLeft: (0.5 + child.depth * 1) + 'rem' }"
              class="child-item"
              @click="selectItem('process', child.id)"
            >
              <span class="tree-arrow">↳</span>
              <span class="item-id">{{ child.id }}</span>
              <span v-if="child.detail" class="item-detail">{{ child.detail }}</span>
            </li>
          </template>
        </template>
      </ul>
    </div>
    <div v-if="groups.length === 0" class="tree-empty">Model is empty</div>
  </div>
</template>

<style scoped>
.model-tree { height: 100%; overflow-y: auto; padding: 0.75rem 0.5rem; }
.tree-group { margin-bottom: 1rem; animation: slideIn 200ms ease backwards; }
.tree-group:nth-child(1) { animation-delay: 0ms; }
.tree-group:nth-child(2) { animation-delay: 30ms; }
.tree-group:nth-child(3) { animation-delay: 60ms; }
.tree-group:nth-child(4) { animation-delay: 90ms; }
.tree-group:nth-child(5) { animation-delay: 120ms; }
.tree-group:nth-child(n+6) { animation-delay: 150ms; }
.group-header {
  font-family: var(--font-mono);
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--text-faint);
  margin-bottom: 0.35rem;
  padding: 0 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.group-header::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border-soft);
}
.group-add {
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--accent);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.62rem;
  width: 16px;
  height: 16px;
  line-height: 1;
  padding: 0;
}
.group-add:hover { border-color: var(--accent); }
.group-items { list-style: none; padding: 0; margin: 0; }
.group-items li {
  padding: 0.25rem 0.5rem;
  cursor: pointer;
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
  transition: background 120ms ease, color 120ms ease;
  border-left: 2px solid transparent;
}
.group-items li:hover { background: var(--bg-elevated); }
.group-items li.active {
  background: var(--accent-soft);
  color: var(--accent-hover);
  border-left-color: var(--accent);
}
.group-items li.child-item {
  border-left: 2px solid var(--border-strong);
  margin-left: 0.5rem;
}
.group-items li.child-item.active {
  border-left-color: var(--accent);
}
.tree-arrow {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  color: var(--text-faint);
  flex-shrink: 0;
}
li.active .tree-arrow { color: var(--accent); }
.item-id { font-family: var(--font-mono); font-size: 0.78rem; }
.item-detail {
  font-size: 0.68rem;
  color: var(--text-muted);
  margin-left: auto;
  font-style: italic;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
li.active .item-detail { color: var(--text-soft); font-style: normal; }
.tree-empty {
  color: var(--text-muted);
  font-size: 0.85rem;
  padding: 2rem 1rem;
  text-align: center;
}
/* The package file map (Wave 1): structure rows, not selections. */
.pkg-file { cursor: default; }
.pkg-file:hover { background: none; }
.pkg-file.import .item-id { color: var(--text-faint); }
</style>
