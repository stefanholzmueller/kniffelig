import {Component, OnInit} from 'angular2/core';
import {ScoreFieldComponent} from './score-field.component';

@Component({
  directives: [ScoreFieldComponent],
  selector: 'game',
  templateUrl: 'app/game.component.html',
})
export class GameComponent implements OnInit {
  public dice = [1,2,3,4,5];
  public rerolls = 0;
  public categories = [
      { name: 'Aces', score: 1 },
      { name: 'Twos', option: 2 },
      { name: 'Threes', option: null },
      { name: 'Fours', score: 4 },
    ];
  public totalUpper = 0;
  public bonus = 0;
  public totalLower = 0;
  public total = 0;

  ngOnInit() {
  }
  findCategory(categoryName) {
    return this.categories.find((elem) => elem.name === categoryName);
  }
  score(categoryName) {
    var category = this.findCategory(categoryName);
    if (category.score === undefined) {
      category.score = category.option;
      this.recalculateScores();
    }
  }
  recalculateScores() {
    this.categories.forEach((category) => {
      console.log(category);
    });
  }
}
