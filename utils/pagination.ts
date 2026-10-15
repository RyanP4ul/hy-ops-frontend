export function getPaginationRange(
  current: number,
  totalPages: number,
  siblingCount = 1,
) {
  const totalNumbers = siblingCount * 2 + 5;

  if (totalPages <= totalNumbers) {
    return Array.from({ length: totalPages }, (_, i) => i);
  }

  const leftSibling = Math.max(current - siblingCount, 0);
  const rightSibling = Math.min(current + siblingCount, totalPages - 1);

  const showLeftDots = leftSibling > 1;
  const showRightDots = rightSibling < totalPages - 2;

  const pages: (number | "...")[] = [];

  pages.push(0);

  if (showLeftDots) {
    pages.push("...");
  } else {
    for (let i = 1; i < leftSibling; i++) {
      pages.push(i);
    }
  }

  for (let i = leftSibling; i <= rightSibling; i++) {
    if (i !== 0 && i !== totalPages - 1) {
      pages.push(i);
    }
  }

  if (showRightDots) {
    pages.push("...");
  } else {
    for (let i = rightSibling + 1; i < totalPages - 1; i++) {
      pages.push(i);
    }
  }

  if (totalPages > 1) {
    pages.push(totalPages - 1);
  }

  return pages;
}
