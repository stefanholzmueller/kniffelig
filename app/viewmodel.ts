export interface ViewModel {
  dice: Number[];
  rerolls: Number;
  categories: Category[];
  totalUpper: Number;
  bonus: Number;
  totalLower: Number;
  total: Number;
}

export interface Category {
  name: String;
  score?: Number;
  option?: Number;
}
