module Test.Main where

import Prelude (Eq, Show, Unit, bind, pure, return)
import Control.Monad.Eff (Eff, runPure)
import Control.Monad.Eff.Console (CONSOLE, print)
import Control.Monad.Eff.Exception
import Control.Monad.Eff.Random (RANDOM)
import Data.Maybe
--import Durstenfeld (shuffle)
import Yahtzee
import Test.QuickCheck
import Test.QuickCheck.Arbitrary
import Test.QuickCheck.Gen (Gen, elements, chooseInt)


data Ternary = Yes | No | Unknown

instance eqTernary :: Eq Ternary where
  eq Yes Yes = true
  eq No No = true
  eq Unknown Unknown = true
  eq _ _ = false

instance showTernary :: Show Ternary where
  show Yes = "Y"
  show No = "N"
  show Unknown = "U"

instance arbTernary :: Arbitrary Ternary where
  arbitrary = elements Yes [Yes, No, Unknown]

prop_true :: Ternary -> Result
prop_true t = t === t


data Dice = Dice (Array Int)

instance arbitraryDice :: Arbitrary Dice where
  arbitrary = genFullHouse

main :: forall eff. QC eff Unit
main = quickCheck (propFullHouse :: Dice -> Result)

genFullHouse :: Gen Dice
genFullHouse = do pips2 <- chooseInt 1 6
                  pips3 <- chooseInt 1 6
                  return (Dice [pips2, pips2, pips3, pips3, pips3])

propFullHouse (Dice dice) = runPure (catchException handler (scoreStr "FullHouse" dice)) === Just 25
  where handler error = pure Nothing
