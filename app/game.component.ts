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
      { name: 'Aces' },
      { name: 'Twos' },
      { name: 'Threes' },
      { name: 'Fours' },
      { name: 'Fives' },
      { name: 'Sixes' },
    ];
  public totalUpper = 0;
  public bonus = 0;
  public totalLower = 0;
  public total = 0;

  ngOnInit() {
    this.recalculateScores();
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
      var maybe = PS.Yahtzee.scoreStr(category.name)(this.dice)();
      category.option = maybe.value0 ? maybe.value0 : null;
      console.log(category);
    });
  }
}
