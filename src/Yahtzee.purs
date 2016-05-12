module Yahtzee where

import Prelude
import Data.Array (group, length, (..), sort, group', filter, takeWhile, reverse)
import Data.Foldable (all, any, elem, sum)
import Data.Generic (class Generic, gEq, gShow)
import Data.Maybe (Maybe(Just, Nothing))


data Category = Aces
              | Twos
              | Threes
              | Fours
              | Fives
              | Sixes
              | ThreeOfAKind
              | FourOfAKind
              | FullHouse
              | SmallStraight
              | LargeStraight
              | Yahtzee
              | Chance

derive instance genericCategory :: Generic Category
instance eqCategory :: Eq Category where
  eq = gEq
instance showCategory :: Show Category where
  show = gShow

data ScoreState = Scored (Maybe Int) | Option (Maybe Int)
data ScoreConstraint = Descending | Ascending | NoRerolls

derive instance genericScoreConstraint :: Generic ScoreConstraint
instance eqScoreConstraint :: Eq ScoreConstraint where
  eq = gEq

type ScoreField = { category :: Category
                  , state :: ScoreState
                  }
type GameState = { scores :: Array ScoreField
                 , constraints :: Array ScoreConstraint
                 , sumUpperSection :: Int
                 , bonusUpperSection :: Int
                 , finalUpperSection :: Int
                 , sumLowerSection :: Int
                 , finalSum :: Int
                 , gameOver :: Boolean -- TODO
                 }

isScored :: ScoreState -> Boolean
isScored (Scored _) = true
isScored (Option _) = false

upperSectionCategories :: Array Category
upperSectionCategories = [ Aces, Twos, Threes, Fours, Fives, Sixes ]
lowerSectionCategories :: Array Category
lowerSectionCategories = [ ThreeOfAKind, FourOfAKind, FullHouse, SmallStraight, LargeStraight, Yahtzee, Chance ]
maxRerolls :: Int
maxRerolls = 2


recalculate :: GameState -> Array Int -> GameState
recalculate game dice = recalculate' score game dice

recalculate' :: (Category -> Array Int -> Maybe Int) -> GameState -> Array Int -> GameState
recalculate' scoreFn game dice = { scores: newScores
                                 , constraints: game.constraints
                                 , sumUpperSection: sumUpperSection
                                 , bonusUpperSection: bonusUpperSection
                                 , finalUpperSection: finalUpperSection
                                 , sumLowerSection: sumLowerSection
                                 , finalSum: finalSum
                                 , gameOver: gameOver
                                 }
  where
    newScores = map (\sf -> sf { state = newScore sf.category sf.state } ) game.scores
    newScore category (Scored m) = Scored m
    newScore category (Option m) = Option (scoreFn category dice)
    gameOver = all (\sf -> isScored sf.state) game.scores
    sumUpperSection = sumSection upperSectionScores
    bonusUpperSection = if sumUpperSection >= 63 then 35 else 0
    finalUpperSection = sumUpperSection + bonusUpperSection
    sumLowerSection = sumSection lowerSectionScores
    finalSum = finalUpperSection + sumLowerSection
    sumSection scores = sum $ map (\sf -> summableScore sf.state) scores
    summableScore (Scored (Just s)) = s
    summableScore _ = 0
    upperSectionScores = filterForCategories upperSectionCategories game.scores
    lowerSectionScores = filterForCategories lowerSectionCategories game.scores
    filterForCategories categories = filter (\sf -> any (_ == sf.category) categories)

recalculateHardcore :: Array GameState -> Int -> Array Int -> Array GameState
recalculateHardcore games rerolls dice = map f games
  where f game = recalculate' (scoreHardcore game rerolls) game dice

scoreHardcore :: GameState -> Int -> Category -> Array Int -> Maybe Int
scoreHardcore game rerolls category dice = if scorable then score category dice else Nothing
  where scorable = all id (map withConstraint game.constraints)
        withConstraint NoRerolls = rerolls == 0
        withConstraint Descending = isContinuous $ game.scores
        withConstraint Ascending = isContinuous $ reverse game.scores
        isContinuous scores = all isScored $ map (_.state) $ takeWhile (\sf -> sf.category /= category) scores

score :: Category -> Array Int -> Maybe Int
score Aces = scorePips 1
score Twos = scorePips 2
score Threes = scorePips 3
score Fours = scorePips 4
score Fives = scorePips 5
score Sixes = scorePips 6
score ThreeOfAKind = scoreKinds 3
score FourOfAKind = scoreKinds 4
score FullHouse = scoreFullHouse
score SmallStraight = scoreStraight 4
score LargeStraight = scoreStraight 5
score Yahtzee = scoreYahtzee
score Chance = (Just <<< sum)


scorePips :: Int -> Array Int -> Maybe Int
scorePips n dice = Just (sum (filter (_ == n) dice))

scoreKinds :: Int -> Array Int -> Maybe Int
scoreKinds n dice = if (isOfAKind dice) then Just (sum dice) else Nothing
  where isOfAKind = group' >>> map length >>> any (_ >= n)

scoreFullHouse :: Array Int -> Maybe Int
scoreFullHouse dice = if (isFullHouse dice) then Just 25 else Nothing
  where isFullHouse dice = (groupDice dice) == [2,3]
        groupDice        = group' >>> map length >>> sort

scoreStraight :: Int -> Array Int -> Maybe Int
scoreStraight n dice = if isStraight then points n else Nothing
  where isStraight = any (\die -> all (_ `elem` dice) (straightStartingFrom die)) dice
        straightStartingFrom die = (die..(die+n-1))
        points 4 = Just 30
        points 5 = Just 40
        points _ = Nothing

scoreYahtzee :: Array Int -> Maybe Int
scoreYahtzee dice = if isYahtzee then Just 50 else Nothing
  where isYahtzee = length (group dice) == 1
