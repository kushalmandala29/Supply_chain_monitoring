"""Pure inventory KPI formulas. No I/O, no config lookups -- callers (mainly
calculator.py) supply already-aggregated numbers pulled via repository.py.
"""


def turnover(cogs: float, average_inventory: float) -> float:
    """Inventory Turnover = COGS / Average Inventory."""
    if average_inventory == 0:
        return 0.0
    return cogs / average_inventory


def inventory_accuracy(system_quantity: float, physical_quantity: float) -> float:
    """Inventory Accuracy = System Inventory / Physical Inventory, as a
    percentage (0-100)."""
    if physical_quantity == 0:
        return 0.0
    return (system_quantity / physical_quantity) * 100.0


def days_on_hand(average_inventory: float, daily_cogs: float) -> float:
    """Days on Hand = Average Inventory / Daily COGS."""
    if daily_cogs == 0:
        return 0.0
    return average_inventory / daily_cogs
