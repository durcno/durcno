/**
 * @param items - List of items to order
 * @param dependencyMap - Dependency map
 * @returns Ordered list of items
 */
export function getOrderedDependencies(
  items: string[],
  dependencyMap: Record<string, string[]>,
): string[] {
  const orderedList: string[] = [];
  const visited = new Set<string>(); // To track visited nodes (avoid infinite loops/cycles)
  const visiting = new Set<string>(); // To track nodes currently in the recursion stack (detect cycles)

  function dfs(item: string) {
    if (visiting.has(item)) {
      // Cycle detected! You might want to throw an error or handle this case.
      console.warn(
        `Cycle detected involving: ${item}. Some dependencies might not be ordered correctly.`,
      );
      return;
    }
    if (visited.has(item)) {
      return; // Already processed this item and its dependencies
    }

    visiting.add(item); // Mark as currently visiting

    const dependencies = dependencyMap[item] || [];
    for (const dep of dependencies) {
      dfs(dep); // Recursively process dependencies first
    }

    // After all dependencies are processed (or a cycle is detected and handled),
    // add the current item to the ordered list.
    orderedList.push(item);
    visited.add(item); // Mark as fully visited
    visiting.delete(item); // Remove from visiting set
  }

  // Iterate over the initial items to start the DFS for each
  for (const item of items) {
    dfs(item);
  }

  return orderedList; // The 'orderedList' will have dependencies first, in reverse topological order.
}
