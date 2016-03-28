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
