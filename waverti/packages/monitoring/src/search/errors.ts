export class BudgetExceededError extends Error {
  constructor(
    public readonly scope: "global" | "user_month" | "user_day",
    message: string,
  ) {
    super(message);
    this.name = "BudgetExceededError";
  }
}
