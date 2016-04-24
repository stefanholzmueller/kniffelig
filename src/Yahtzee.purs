module Yahtzee where

import Prelude
import Data.Array
import Data.Foldable
import Data.Generic
import Data.Maybe


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

data ScoreState = Scored (Maybe Int) | Option (Maybe Int) | Undefined

type Score = { category :: Category, value :: Maybe Int }
type ScoreField = { category :: Category, state :: ScoreState }
type ScoreColumn = Array ScoreField
type GameState = { scores :: ScoreColumn
                 , sumUpperSection :: Int
                 , bonusUpperSection :: Int
                 , finalUpperSection :: Int
                 , sumLowerSection :: Int
                 , finalSum :: Int
                 , gameOver :: Boolean
                 } 

upperSectionCategories :: Array Category
upperSectionCategories = [ Aces, Twos, Threes, Fours, Fives, Sixes ]
lowerSectionCategories :: Array Category
lowerSectionCategories = [ ThreeOfAKind, FourOfAKind, FullHouse, SmallStraight, LargeStraight, Yahtzee, Chance ]
maxRerolls :: Int
maxRerolls = 2


recalculate :: Array Score -> Array Int -> GameState
recalculate scores dice = { scores: scoreColumn
                          , sumUpperSection: sumUpperSection
                          , bonusUpperSection: bonusUpperSection
                          , finalUpperSection: finalUpperSection
                          , sumLowerSection: sumLowerSection
                          , finalSum: finalSum
                          , gameOver: gameOver
                          }
  where
    scoreColumn = map convertScore scores
    convertScore sf = { category: sf.category, state: convertState sf }
    convertState sf = if isJust sf.value then Scored sf.value else Option (score sf.category dice)
    gameOver = all (\s -> isJust s.value) scores
    sumUpperSection = sumSection upperSectionScores
    bonusUpperSection = if sumUpperSection >= 63 then 35 else 0
    finalUpperSection = sumUpperSection + bonusUpperSection
    sumLowerSection = sumSection lowerSectionScores
    finalSum = finalUpperSection + sumLowerSection
    sumSection scores = sum $ map (\s -> fromMaybe 0 s.value) scores
    upperSectionScores = filterForCategories upperSectionCategories scores
    lowerSectionScores = filterForCategories lowerSectionCategories scores
    filterForCategories categories = filter (\sf -> any (==sf.category) categories)


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
scorePips n dice = Just (sum (filter (==n) dice))

scoreKinds :: Int -> Array Int -> Maybe Int
scoreKinds n dice = if (isOfAKind dice) then Just (sum dice) else Nothing
  where isOfAKind = group' >>> map length >>> any (>=n)

scoreFullHouse :: Array Int -> Maybe Int
scoreFullHouse dice = if (isFullHouse dice) then Just 25 else Nothing
  where isFullHouse dice = (groupDice dice) == [2,3]
        groupDice        = group' >>> map length >>> sort

scoreStraight :: Int -> Array Int -> Maybe Int
scoreStraight n dice = if isStraight then points n else Nothing
  where isStraight = any (\die -> all (`elem` dice) (straightStartingFrom die)) dice
        straightStartingFrom die = (die..(die+n-1))
        points 4 = Just 30
        points 5 = Just 40
        points _ = Nothing

scoreYahtzee :: Array Int -> Maybe Int
scoreYahtzee dice = if isYahtzee then Just 50 else Nothing
  where isYahtzee = length (group dice) == 1
