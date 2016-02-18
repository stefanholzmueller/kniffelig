module Yahtzee where

import Prelude
import Control.Monad.Eff
import Control.Monad.Eff.Exception
import Data.Array
import Data.Foldable
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

parse :: forall eff. String -> Eff (err :: EXCEPTION | eff) Category
parse "Aces" = pure Aces
parse "Twos" = pure Twos
parse "Threes" = pure Threes
parse "Fours" = pure Fours
parse "Fives" = pure Fives
parse "Sixes" = pure Sixes
parse "ThreeOfAKind" = pure ThreeOfAKind
parse "FourOfAKind" = pure FourOfAKind
parse "FullHouse" = pure FullHouse
parse _ = throw "aaaaaaaa"

scoreStr :: forall eff. String -> Array Int -> Eff (err :: EXCEPTION | eff) (Maybe Int)
scoreStr categoryStr dice = do
  category <- parse categoryStr
  return (score category dice)
--scoreStr categoryStr dice = (parse categoryStr) >>= \category -> return (score category dice)

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


scorePips :: Int -> Array Int -> Maybe Int
scorePips n dice = Just (sum (filter (==n) dice))

scoreKinds :: Int -> Array Int -> Maybe Int
scoreKinds n dice = if (isOfAKind dice) then Just (sum dice) else Nothing
  where isOfAKind = sort >>> groupBy (==) >>> map length >>> any (>=n)

scoreFullHouse :: Array Int -> Maybe Int
scoreFullHouse dice = if (isFullHouse dice == [2,3]) then Just 25 else Nothing
  where isFullHouse = sort >>> groupBy (==) >>> map length >>> sort
