from typing import Any, Dict, List, Optional


def insertion_sort_by_key(items: List[Dict[str, Any]], key: str) -> List[Dict[str, Any]]:
    sorted_items = items.copy()
    for i in range(1, len(sorted_items)):
        current = sorted_items[i]
        j = i - 1
        while j >= 0 and (current.get(key, 0) or 0) > (sorted_items[j].get(key, 0) or 0):
            sorted_items[j + 1] = sorted_items[j]
            j -= 1
        sorted_items[j + 1] = current
    return sorted_items


def binary_search_iterative(sorted_titles: List[str], target: str) -> int:
    start = 0
    end = len(sorted_titles) - 1
    target_lower = target.lower()
    while start <= end:
        mid = start + (end - start) // 2
        mid_value = sorted_titles[mid].lower()
        if mid_value == target_lower:
            return mid
        if mid_value < target_lower:
            start = mid + 1
        else:
            end = mid - 1
    return -1


def binary_search_recursive(sorted_titles: List[str], target: str, start: int, end: int) -> int:
    if start > end:
        return -1
    mid = start + (end - start) // 2
    mid_value = sorted_titles[mid].lower()
    target_lower = target.lower()
    if mid_value == target_lower:
        return mid
    if mid_value < target_lower:
        return binary_search_recursive(sorted_titles, target, mid + 1, end)
    return binary_search_recursive(sorted_titles, target, start, mid - 1)


def linear_search(items: List[Dict[str, Any]], key: str, value: Any) -> Optional[Dict[str, Any]]:
    found = None
    for item in items:
        item_value = item.get(key)
        if isinstance(item_value, str) and isinstance(value, str):
            if item_value.lower() == value.lower():
                found = item
                break
        elif item_value == value:
            found = item
            break
    return found
