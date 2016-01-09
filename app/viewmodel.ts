export interface ViewModel {
  dice: Number[];
  categories: Category[];
  totalUpper: Number;
  bonus: Number;
  totalLower: Number;
  total: Number;
}

export interface Category {
  name: String;
  value: Number;
}
