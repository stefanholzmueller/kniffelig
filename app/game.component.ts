import {Component, OnInit} from 'angular2/core';
import {ScoreFieldComponent} from './score-field.component';
import {ViewModel, Category} from './viewmodel';

@Component({
  directives: [ScoreFieldComponent],
  selector: 'game',
  templateUrl: 'app/game.component.html',
})
export class GameComponent implements OnInit {
  public vm: ViewModel = {
    dice: [1,2,3,4,5],
    rerolls: 0,
    categories: [
      { name: 'Aces', score: 1 },
      { name: 'Twos', option: 2 },
      { name: 'Threes', option: null },
      { name: 'Fours', score: 4 },
    ],
    totalUpper: 0,
    bonus: 0,
    totalLower: 0,
    total: 0
  };
  ngOnInit() {
  }
  findCategory(categoryName) {
    return this.vm.categories.find((elem) => elem.name === categoryName);
  }
  score(categoryName) {
    var category = this.findCategory(categoryName);
    if (category.score === undefined) {
      category.score = category.option;
    }
  }
}
