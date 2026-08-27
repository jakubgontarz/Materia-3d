import { Node3D, Element3D, Panel3D } from '../fem/types';

export function mergeOverlapping(
  nodes: Node3D[],
  elements: Element3D[],
  panels: Panel3D[],
  tolerance: number
) {
  const nodeMap = new Map<number, number>();
  const mergedNodes: Node3D[] = [];

  // Sort nodes by ID so we always keep the oldest node
  const sortedNodes = [...nodes].sort((a, b) => a.id - b.id);

  for (const node of sortedNodes) {
    let mergedTo = -1;
    for (const kept of mergedNodes) {
      const dx = node.x - kept.x;
      const dy = node.y - kept.y;
      const dz = node.z - kept.z;
      const dist = Math.hypot(dx, dy, dz);
      if (dist <= tolerance) {
        mergedTo = kept.id;
        break;
      }
    }

    if (mergedTo !== -1) {
      nodeMap.set(node.id, mergedTo);
    } else {
      nodeMap.set(node.id, node.id);
      mergedNodes.push(node);
    }
  }

  const mergedElements: Element3D[] = [];
  const elemMap = new Map<string, number>();

  for (const el of elements) {
    const newN1 = nodeMap.get(el.n1) ?? el.n1;
    const newN2 = nodeMap.get(el.n2) ?? el.n2;

    if (newN1 === newN2) {
      continue; // Degenerate element, discard
    }

    const minN = Math.min(newN1, newN2);
    const maxN = Math.max(newN1, newN2);
    const key = `${minN}-${maxN}`;

    if (!elemMap.has(key)) {
      elemMap.set(key, el.id);
      mergedElements.push({
        ...el,
        n1: newN1,
        n2: newN2,
      });
    }
    // else discard the duplicate element
  }

  const mergedPanels: Panel3D[] = [];
  for (const p of panels) {
    const newNodes = p.nodeIds.map(nId => nodeMap.get(nId) ?? nId);
    
    // Remove consecutive duplicates
    const deduplicatedNodes: number[] = [];
    for (const n of newNodes) {
      if (deduplicatedNodes.length === 0 || deduplicatedNodes[deduplicatedNodes.length - 1] !== n) {
        deduplicatedNodes.push(n);
      }
    }
    // Check if first and last are same (wrap around)
    if (deduplicatedNodes.length > 1 && deduplicatedNodes[0] === deduplicatedNodes[deduplicatedNodes.length - 1]) {
      deduplicatedNodes.pop();
    }

    if (deduplicatedNodes.length >= 3) {
      mergedPanels.push({
        ...p,
        nodeIds: deduplicatedNodes,
      });
    }
  }

  return { mergedNodes, mergedElements, mergedPanels, nodeMap };
}